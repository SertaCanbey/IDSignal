import http from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { Store } from './src/store.mjs';
import { Graph, GraphError } from './src/graph.mjs';
import { analyze } from './src/analysis.mjs';
import { parseSignInImport } from './src/import.mjs';
import { PortalAutomation } from './src/portal.mjs';
import { Audit, AuditError } from './src/audit.mjs';
import { withAzureLogin, provision, SetupError } from './src/provision.mjs';
import { GeoResolver } from './src/geo.mjs';
import { parseSafeIps } from './src/network.mjs';

const HERE=dirname(fileURLToPath(import.meta.url));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const token=()=>randomBytes(32).toString('hex');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const hash=(password,salt)=>scryptSync(password,salt,64).toString('hex');
export function createApp({dataDir=process.env.DATA_DIR || join(process.env.LOCALAPPDATA || HERE,'IDSignal','data'),origin=process.env.APP_ORIGIN || 'http://localhost:4317',allowedOrigins=[],fetcher=fetch,scheduled=true,portalOptions={},setupLogin=withAzureLogin,setupProvision=provision}={}) {
  const base=new URL(origin);
  if(base.origin!==origin || base.username || base.password)throw Error('APP_ORIGIN yalnızca protokol, host ve port içermeli.');
  const origins=new Set([origin,...allowedOrigins].map(value=>new URL(value).origin));
  if([...origins].some(value=>{const u=new URL(value);return u.username||u.password;}))throw Error('İzin verilen adres geçersiz.');
  const store=new Store(dataDir), sessions=new Map(), attempts=new Map();
  const geo=new GeoResolver(store,{fetcher});
  let busy=false, progress='', importToken=null, consent=null, timer;
  let apiSetup={active:false}, setupAbort, closing=false;
  const portal=new PortalAutomation({...portalOptions,importEvents:(events,metadata)=>{
    const c=store.get('connection');if(!c||c.tenantId!==metadata.tenantId)throw fail(409,'Bağlı tenant değişti; aktarım durduruldu.');
    return store.importEvents(events,metadata);
  }});
  const connection=()=>{const c=store.get('connection');return c?{...c,secret:store.decrypt(c.secret)}:null;};
  const config=()=>({intervalMinutes:15,initialDays:7,mode:'premium',safeIps:[],...store.get('config',{})});
  function session(req) {const id=/\bir_session=([a-f0-9]{64})\b/.exec(req.headers.cookie||'')?.[1], s=sessions.get(id);return s&&s.expires>Date.now()?{...s,id}:null;}
  function newSession(res,role='admin') {const id=token(),s={csrf:token(),role,expires:Date.now()+8*3600000};sessions.set(id,s);res.setHeader('Set-Cookie',`ir_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${base.protocol==='https:'?'; Secure':''}`);return s;}
  async function body(req,maxBytes=16384) {const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw fail(413,'İstek çok büyük. Dosyayı daha küçük tarih aralıklarına bölün.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,'')||'{}');}catch{throw fail(400,'Geçersiz JSON.');}}
  const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  function saveConnection(b) {
    if(busy||portal.active()||apiSetup.active)throw fail(409,'Eşitleme veya kurulum sürerken bağlantı değiştirilemez.');
    if(!uuid.test(b.tenantId||'')||!uuid.test(b.clientId||'')||typeof b.secret!=='string'||!b.secret.trim()||b.secret.length>4096)throw fail(400,'Geçerli Tenant ID, Client ID ve client secret değeri gerekli.');
    const old=store.get('connection');
    if(old && old.tenantId.toLowerCase()!==b.tenantId.toLowerCase())throw fail(409,'Farklı tenant için önce mevcut bağlantıyı kaldırın.');
    consent=null;store.set('connection',{tenantId:b.tenantId.toLowerCase(),clientId:b.clientId.toLowerCase(),secret:store.encrypt(b.secret),verified:false,updatedAt:Date.now()});
  }
  async function sync() {
    if(busy||portal.active()||apiSetup.active||closing)return;const c=connection();if(!c)return;
    busy=true;const before=store.get('sync',{}), end=new Date(),cfg=config();
    const since=new Date(Math.max(Date.now()-30*86400000,before.until?Date.parse(before.until)-86400000:Date.now()-cfg.initialDays*86400000)).toISOString();
    try {
      const graph=new Graph(c,{fetcher});
      progress='Kullanıcı dizini alınıyor';
      const users=await graph.list('users?$select=id,displayName,userPrincipalName,accountEnabled');
      if(cfg.mode==='m365'){
        let mfa=store.get('mfa',[]),mfaError=null,mfaLastSuccess=before.mfaLastSuccess;
        if(!mfaLastSuccess||Date.now()-Date.parse(mfaLastSuccess)>24*3600000){
          try{
            progress='MFA yöntemleri alınıyor';
            mfa=await graph.authenticationRegistrations(users,n=>{progress=`MFA yöntemleri: ${n.toLocaleString('tr-TR')} / ${users.length.toLocaleString('tr-TR')} kullanıcı`;});
            mfaLastSuccess=new Date().toISOString();
          }catch(e){if(!(e instanceof GraphError))throw e;mfaError=e.message;}
        }
        const saved=store.get('auditConnection');
        const credentials=saved?{...saved,secret:store.decrypt(saved.secret)}:c;
        const result=await new Audit(credentials,{fetcher}).collect({users,previous:before.auditCursor||{},initialDays:cfg.initialDays,progress:value=>{progress=value;}});
        store.commitSync(users,mfa,result.events,{...before,mode:'m365',lastAttempt:new Date().toISOString(),lastDirectorySuccess:new Date().toISOString(),mfaLastSuccess,mfaError,...(result.waiting?{}:{lastSuccess:new Date().toISOString(),auditLastSuccess:new Date().toISOString()}),auditCursor:result.state,auditMessage:result.message,auditWaiting:result.waiting,auditPackages:result.packages||0,since:result.state.since,error:null});
        store.set('connection',{...store.get('connection'),directoryVerified:true});return;
      }
      if(cfg.mode==='free') {
        store.commitSync(users,[],[],{...before,lastDirectorySuccess:new Date().toISOString(),lastAttempt:new Date().toISOString(),mode:'free',error:null});
        store.set('connection',{...store.get('connection'),directoryVerified:true});return;
      }
      progress='MFA kayıt bilgileri alınıyor';
      const mfa=await graph.list('reports/authenticationMethods/userRegistrationDetails');
      progress='Oturum kayıtları alınıyor';
      const events=await graph.list('auditLogs/signIns?'+new URLSearchParams({'$filter':`createdDateTime ge ${since} and createdDateTime le ${end.toISOString()}`,'$top':'1000'}),n=>{progress=`${n.toLocaleString('tr-TR')} oturum kaydı alındı`;});
      // Atomic publication: errors never replace a complete snapshot with partial data.
      store.commitSync(users,mfa,events,{lastSuccess:new Date().toISOString(),lastDirectorySuccess:new Date().toISOString(),mode:'premium',until:end.toISOString(),since:before.since||since,error:null});
      store.set('connection',{...store.get('connection'),verified:true,directoryVerified:true});
    } catch(e) {store.set('sync',{...before,mode:cfg.mode,lastAttempt:new Date().toISOString(),error:e instanceof GraphError||e instanceof AuditError?e.message:'Eşitleme tamamlanamadı. Ağ erişimini ve yerel veri depolamasını kontrol edin.'});}
    finally{busy=false;progress='';}
  }
  async function connectApi(){
    apiSetup={active:true,message:'Microsoft girişi hazırlanıyor.'};setupAbort=new AbortController();
    const timeout=setTimeout(()=>setupAbort.abort(),15*60000).unref();
    const update=message=>{apiSetup={active:true,message};};
    try{
      const existing=connection(),pending=store.get('apiSetupPending');
      const tenantId=existing?.tenantId||pending?.tenantId;
      await setupLogin({tenantId,signal:setupAbort.signal,progress:update},async login=>{
        if(tenantId&&login.tenantId!==tenantId)throw new SetupError('Giriş yapılan tenant bağlantıyla eşleşmiyor.');
        const result=await setupProvision({...login,clientId:existing?.clientId||pending?.clientId,signal:setupAbort.signal,progress:update,fetcher,checkpoint:value=>store.set('apiSetupPending',value)});
        if(closing)throw new SetupError('Sunucu kapatılıyor. Kurulumu yeniden başlatın.');
        const secret=existing?.secret||await result.createSecret();
        store.set('connection',{tenantId:result.tenantId,clientId:result.clientId,secret:store.encrypt(secret),verified:false,updatedAt:Date.now()});
        store.db.prepare('DELETE FROM settings WHERE key IN (?,?)').run('auditConnection','apiSetupPending');
        store.set('config',{...config(),mode:'m365'});
        const previous=store.get('sync',{});store.set('sync',{...previous,error:null,auditCursor:undefined,auditLastSuccess:null,auditWaiting:null});
      });
      if (fetcher === fetch && process.env.NODE_ENV !== 'test') {
        update('API izinleri hazır. Değişikliklerin Microsoft sunucularına yansıması bekleniyor (15 sn)...');
        await new Promise(r => setTimeout(r, 15000));
      }
      apiSetup={active:false,message:'API izinleri hazır. İlk veri toplama başlatıldı.'};
      await sync();
      if(!closing){const s=store.get('sync',{});apiSetup={active:false,message:s.error?'İzin kurulumu tamamlandı; veri erişimi doğrulanamadı.':s.auditWaiting?s.auditMessage:'API bağlantısı doğrulandı.',error:s.error||null};}
    }catch(e){apiSetup={active:false,error:e instanceof SetupError?e.message:'API kurulumu tamamlanamadı. Aynı düğmeyle yeniden deneyin.'};}
    finally{clearTimeout(timeout);}
  }
  function status(auth) {
    const c=store.get('connection'),a=store.get('auditConnection'),s=store.get('sync',{});
    const {auditCursor,...publicSync}=s;
    const admin=auth?.role==='admin';
    return {initialized:!!store.get('admin'),shared:!!store.get('viewer'),authenticated:!!auth,readOnly:!!auth&&!admin,loginRole:auth?.role||null,...(auth?{csrf:auth.csrf,...(admin?{apiSetup,connection:c?{tenantId:c.tenantId,clientId:c.clientId,verified:c.verified,directoryVerified:c.directoryVerified,updatedAt:c.updatedAt}:null,auditConnection:a?{clientId:a.clientId}:null,portal:{...portal.status(),active:portal.active(),running:portal.running},redirectUri:origin+'/auth/callback'}:{connection:c?{verified:c.verified,directoryVerified:c.directoryVerified}:null}),sync:{...publicSync,busy:admin&&busy,progress:admin?progress:''},import:store.get('import'),config:config()}:{})};
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      if(![...origins].some(value=>new URL(value).host===req.headers.host))throw fail(403,'İstek adresi geçersiz. Uygulamayı yapılandırılmış adresiyle açın.');
      const u=new URL(req.url,origin), auth=session(req);
      if(req.method==='GET' && u.pathname==='/api/status')return send(res,200,status(auth));
      if(req.method==='GET' && u.pathname==='/auth/callback') {
        const pending=consent;consent=null;
        if(!auth||auth.role!=='admin'||!pending||pending.session!==auth.id||pending.expires<Date.now()||u.searchParams.get('state')!==pending.state)throw fail(400,'Onay oturumu geçersiz veya süresi dolmuş. Bağlantı ekranından tekrar deneyin.');
        const c=store.get('connection');
        if(u.searchParams.has('error')||u.searchParams.get('admin_consent')?.toLowerCase()!=='true'||u.searchParams.get('tenant')?.toLowerCase()!==c.tenantId) {
          store.set('sync',{...store.get('sync',{}),error:'Yönetici onayı tamamlanmadı. Doğru tenant ile tekrar deneyin.'});
        } else { void sync(); }
        res.writeHead(303,{Location:'/#sources'});return res.end();
      }
      if(req.method==='GET' && ['/','/app.js','/style.css','/logo.png','/landing.html','/demo.html'].includes(u.pathname)) {
        const name=u.pathname==='/'?'index.html':u.pathname.slice(1);
        res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.png')?'image/png':'text/css; charset=utf-8'});
        return res.end(readFileSync(join(HERE,'public',name)));
      }
      // A short-lived, single-use token bridges the administrator-run setup script.
      if(req.method==='POST' && u.pathname==='/api/bootstrap-import') {
        if(req.headers.origin && !origins.has(req.headers.origin))throw fail(403,'İstek kaynağı geçersiz.');
        if(!importToken||importToken.expires<Date.now()||req.headers.authorization!==`Bearer ${importToken.value}`)throw fail(403,'Kurulum bağlantısının süresi doldu. Yeni betik indirin.');
        const b=await body(req);if(b.tenantId?.toLowerCase()!==importToken.tenantId)throw fail(400,'Tenant eşleşmiyor.');
        saveConnection(b);importToken=null;return send(res,200,{ok:true});
      }
      if(req.method==='POST') {
        if(!origins.has(req.headers.origin))throw fail(403,'İstek kaynağı geçersiz.');
        if(!req.headers['content-type']?.startsWith('application/json'))throw fail(415,'JSON gerekli.');
        if(['/api/setup','/api/login'].includes(u.pathname)) {
          const b=await body(req),addr=req.socket.remoteAddress,limit=attempts.get(addr);
          if(limit && limit.until>Date.now() && limit.count>=5)throw fail(429,'Çok fazla deneme. 15 dakika sonra tekrar deneyin.');
          if(u.pathname==='/api/setup') {
            if(store.get('admin'))throw fail(409,'Kurulum zaten tamamlandı.');
            if(typeof b.password!=='string'||b.password.length<12||b.password.length>128)throw fail(400,'Yönetici parolası 12–128 karakter olmalı.');
            const salt=token();store.set('admin',{salt,hash:hash(b.password,salt)});
          } else {
            const role=b.role==='admin'||!store.get('viewer')?'admin':'viewer',a=store.get(role);
            if(!a||typeof b.password!=='string'||b.password.length>128||!timingSafeEqual(Buffer.from(hash(b.password,a.salt),'hex'),Buffer.from(a.hash,'hex'))) {
              attempts.set(addr,{count:limit&&limit.until>Date.now()?limit.count+1:1,until:Date.now()+15*60000});throw fail(401,'Parola hatalı.');
            }
          }
          attempts.delete(addr); const role=u.pathname==='/api/setup'||b.role==='admin'||!store.get('viewer')?'admin':'viewer',s=newSession(res,role);return send(res,200,status(s));
        }
      }
      if(!auth)throw fail(401,'Oturum açmanız gerekiyor.');
      if(req.method==='GET'&&u.pathname==='/api/geo'){
        const ip=u.searchParams.get('ip')||'';const result=await geo.lookup(ip);
        return send(res,200,{ip:result.ip,countryOrRegion:result.countryOrRegion||null,countryCode:result.countryCode||null,city:result.city||null,success:result.success!==false,source:result.source});
      }
      if(req.method==='POST'&&req.headers['x-csrf-token']!==auth.csrf)throw fail(403,'Oturumu yenileyip tekrar deneyin.');
      if(req.method==='POST'&&u.pathname==='/api/logout') {sessions.delete(auth.id);if(auth.role==='admin'){importToken=null;consent=null;await portal.cancel();}res.setHeader('Set-Cookie','ir_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
      if(req.method==='POST'&&auth.role!=='admin')throw fail(403,'Ekip oturumu salt okunurdur. Yönetici girişi yapın.');
      if(req.method==='POST'&&apiSetup.active)throw fail(409,'API kurulumu sürüyor. Microsoft girişini tamamlayın.');
      if(req.method==='POST'&&u.pathname==='/api/connect-api'){
        await body(req);
        if(busy||portal.active())throw fail(409,'Önce devam eden veri toplama işlemini bitirin.');
        void connectApi();return send(res,202,{ok:true});
      }
      if(req.method==='POST'&&u.pathname==='/api/connection') {saveConnection(await body(req));return send(res,200,{ok:true});}
      if(req.method==='POST'&&u.pathname==='/api/audit-connection'){
        if(busy||portal.active())throw fail(409,'Önce devam eden eşitlemeyi veya portal oturumunu bitirin.');
        const c=store.get('connection');if(!c)throw fail(400,'Önce tenant/dizin bağlantısını kaydedin.');
        const b=await body(req);
        if(b.useExisting===true)store.db.prepare('DELETE FROM settings WHERE key=?').run('auditConnection');
        else{
          if(!uuid.test(b.clientId||'')||typeof b.secret!=='string'||!b.secret.trim()||b.secret.length>4096)throw fail(400,'Geçerli Audit Client ID ve secret gerekli.');
          store.set('auditConnection',{tenantId:c.tenantId,clientId:b.clientId.toLowerCase(),secret:store.encrypt(b.secret)});
        }
        const s=store.get('sync',{});store.set('sync',{...s,auditCursor:undefined,auditMessage:null,auditWaiting:null,auditLastSuccess:null});consent=null;return send(res,200,{ok:true});
      }
      if(req.method==='POST'&&u.pathname==='/api/disconnect') {if(busy||portal.active())throw fail(409,'Önce eşitlemeyi veya portal işlemini bitirin.');store.resetConnection();consent=null;importToken=null;return send(res,200,{ok:true});}
      if(req.method==='POST'&&u.pathname==='/api/consent') {
        const b=await body(req),audit=b.resource==='m365';
        const c=(audit&&store.get('auditConnection'))||store.get('connection');if(!c)throw fail(400,'Önce uygulama bağlantı bilgilerini kaydedin.');
        consent={state:token(),session:auth.id,expires:Date.now()+15*60000};
        const url=`https://login.microsoftonline.com/${c.tenantId}/v2.0/adminconsent?`+new URLSearchParams({client_id:c.clientId,scope:(audit?'https://manage.office.com':'https://graph.microsoft.com')+'/.default',redirect_uri:origin+'/auth/callback',state:consent.state});return send(res,200,{url});
      }
      if(req.method==='POST'&&u.pathname==='/api/bootstrap-script') {
        const b=await body(req);if(!uuid.test(b.tenantId||''))throw fail(400,'Geçerli Tenant ID gerekli.');
        if(store.get('connection'))throw fail(409,'Mevcut bağlantı var. Yeni kayıt oluşturmadan önce bağlantıyı kaldırın.');
        importToken={value:token(),tenantId:b.tenantId.toLowerCase(),expires:Date.now()+30*60000};
        const script=readFileSync(join(HERE,'scripts','register-entra.ps1'),'utf8').replaceAll('__TENANT__',importToken.tenantId).replaceAll('__ORIGIN__',origin).replaceAll('__TOKEN__',importToken.value).replace("'AuditLog.Read.All', 'User.Read.All', 'UserAuthenticationMethod.Read.All'",config().mode!=='premium'?"'User.Read.All', 'UserAuthenticationMethod.Read.All'":"'AuditLog.Read.All', 'User.Read.All', 'UserAuthenticationMethod.Read.All'");
        return send(res,200,{script});
      }
      if(req.method==='POST'&&u.pathname==='/api/sync') {if(!connection())throw fail(400,'Önce Entra bağlantısını kurun.');if(busy||portal.active())throw fail(409,'Eşitleme veya portal işlemi zaten sürüyor.');void sync();return send(res,202,{ok:true});}
      if(req.method==='POST'&&u.pathname==='/api/portal/start') {
        if(busy)throw fail(409,'Önce mevcut eşitlemenin bitmesini bekleyin.');
        const c=store.get('connection');if(!c||config().mode!=='free')throw fail(400,'Önce tenant bağlantısını kaydedin ve ücretsiz modu seçin.');
        if(portal.active()||portal.running)throw fail(409,'Portal oturumu zaten açık.');
        if(!portal.status().available)throw fail(409,portal.status().reason);
        void portal.start(c.tenantId).catch(()=>{});return send(res,202,{ok:true});
      }
      if(req.method==='POST'&&u.pathname==='/api/portal/continue') {
        const b=await body(req),c=store.get('connection');
        if(!portal.active()||portal.running)throw fail(409,'Portal oturumu hazır değil veya işlem sürüyor.');
        if(!c||b.tenantId!==c.tenantId||b.confirmTenant!==true)throw fail(400,'Edge’de doğru tenant’ın seçili olduğunu doğrulayın.');
        void portal.continue({tenantId:c.tenantId,confirmed:true,listenOnly:b.listenOnly===true}).catch(()=>{});return send(res,202,{ok:true});
      }
      if(req.method==='POST'&&u.pathname==='/api/portal/cancel') {await portal.cancel();return send(res,200,{ok:true});}
      if(req.method==='POST'&&u.pathname==='/api/settings') {
        const b=await body(req);
        if(![0,15,30,60].includes(b.intervalMinutes)||![1,7,30].includes(b.initialDays))throw fail(400,'Geçersiz eşitleme ayarı.');
        let safeIps;try{safeIps=parseSafeIps(b.safeIps||[]);}catch(e){throw fail(400,e.message);}
        store.set('config',{...config(),intervalMinutes:b.intervalMinutes,initialDays:b.initialDays,safeIps});return send(res,200,{ok:true,safeIpCount:safeIps.length});
      }
      if(req.method==='POST'&&u.pathname==='/api/viewer-password') {
        const b=await body(req);
        if(typeof b.password!=='string'||b.password.length<1||b.password.length>128)throw fail(400,'Ekip parolası 1-128 karakter olmalıdır.');
        const salt=token();store.set('viewer',{salt,hash:hash(b.password,salt)});
        return send(res,200,{ok:true});
      }
      if(req.method==='POST'&&u.pathname==='/api/mode') {
        if(busy||portal.active())throw fail(409,'Mod değiştirmeden önce eşitlemenin veya portal işleminin bitmesini bekleyin.');
        const b=await body(req);if(!['free','premium','m365'].includes(b.mode))throw fail(400,'Geçersiz çalışma modu.');
        store.set('config',{...config(),mode:b.mode});return send(res,200,{ok:true});
      }
      if(req.method==='POST'&&u.pathname==='/api/import-signins') {
        if(busy||portal.active())throw fail(409,'Önce eşitlemenin veya portal işleminin bitmesini bekleyin.');
        const c=store.get('connection');if(!c)throw fail(400,'Dosyayı doğru tenant ile eşleştirmek için önce bağlantı bilgilerini kaydedin.');
        const b=await body(req,25*1024*1024);
        if(b.confirmTenant!==true||b.tenantId?.toLowerCase()!==c.tenantId)throw fail(400,'Dosyanın seçili tenant’a ait olduğunu doğrulayın.');
        const parsed=parseSignInImport(b.document);
        const result=store.importEvents(parsed.events,{lastImport:new Date().toISOString(),tenantId:c.tenantId,total:parsed.total,expired:parsed.expired,duplicates:parsed.duplicates});
        return send(res,200,result);
      }
      if(req.method==='GET'&&u.pathname==='/api/dashboard') {
        const days=Number(u.searchParams.get('days')||7);if(![1,7,30].includes(days))throw fail(400,'Geçersiz dönem.');
        const since=new Date(Date.now()-days*86400000).toISOString();store.prune();
        const mode=config().mode;
        const prevSince=new Date(Date.now()-(days*2)*86400000).toISOString();
        const allEvents=store.events(prevSince).filter(e=>mode==='m365'?e._source==='m365-audit':e._source!=='m365-audit');
        const events=allEvents.filter(e=>e.createdDateTime>=since).map(e=>{
          const location=geo.cached(e.ipAddress);return location?.countryOrRegion?{...e,location:{...(e.location||{}),countryOrRegion:location.countryOrRegion,city:location.city||''}}:e;
        });
        const prevCount = allEvents.length - events.length;
        // Both Graph premium mode and Microsoft 365 Audit mode collect MFA
        // authentication methods. Only file/free mode deliberately hides MFA.
        const data=analyze(store.get('users',[]),mode==='free'?[]:store.get('mfa',[]),events,{safeIps:config().safeIps});
        data.metrics.prevEvents = prevCount;
        return send(res,200,{...data,days,since,mode:config().mode,import:store.get('import'),sync:status(auth).sync});
      }
      throw fail(404,'Sayfa bulunamadı.');
    } catch(e) {send(res,e.status||500,{error:e.status?e.message:'İşlem tamamlanamadı. Uygulamayı yeniden başlatıp deneyin.'});}
  });
  if(scheduled)timer=setInterval(()=>{
    for(const [id,s] of sessions)if(s.expires<Date.now())sessions.delete(id);
    const c=config(),s=store.get('sync',{});
    if(c.intervalMinutes && connection() && Date.now()-Date.parse(s.lastAttempt||s.lastSuccess||0)>=c.intervalMinutes*60000)void sync();
  },60000).unref();
  server.on('close',()=>{closing=true;setupAbort?.abort();clearInterval(timer);void portal.cancel();store.close();});
  return {server,store,sync,portal};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  const port=Number(process.env.PORT||4317),host=process.env.HOST||'0.0.0.0';
  const allowedOrigins=(process.env.APP_ALLOWED_ORIGINS||'http://192.168.60.178:4317').split(',').filter(Boolean);
  const app=createApp({allowedOrigins});app.server.listen(port,host,()=>console.log(`IDSignal hazır: ${process.env.APP_ORIGIN||'http://localhost:4317'}`));
  process.on('SIGINT',()=>app.server.close());process.on('SIGTERM',()=>app.server.close());
}

