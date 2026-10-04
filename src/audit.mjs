import {createHash} from 'node:crypto';
import {applicationName} from './catalog.mjs';
import {normalizeIp} from './network.mjs';

export class AuditError extends Error {}
const root='https://manage.office.com';
const day=86400000;
const codes={invalidusernameorpassword:50126,credentialauthenticationerror:50064,idslocked:50053,userstrongauthenrollmentrequiredinterrupt:50072,userstrongauthclientauthnrequiredinterrupt:50074,userstrongauthclientauthnrequired:50076,userstrongauthexpired:50078,userstrongauthenrollmentrequired:50079,authenticationfailedduringstrongauthenticationrequest:500121,strongauthenticationfailed:500121};
const text=v=>typeof v==='string'?v.slice(0,500):'';
export function normalizeAudit(row,users,tenantId){
  if(!['UserLoggedIn','UserLoginFailed'].includes(row.Operation))return null;
  if(row.OrganizationId&&String(row.OrganizationId).toLowerCase()!==tenantId.toLowerCase())throw new AuditError('Audit olayının tenant kimliği bağlantıyla eşleşmiyor; aktarım durduruldu.');
  const upn=text(row.UserId||row.Identity).trim().toLowerCase();
  const rawTime=text(row.CreationTime);
  const time=Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(rawTime)?rawTime:rawTime+'Z');
  if(!upn||!Number.isFinite(time))return null;
  if(upn.includes('||')||/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(upn)||!upn.includes('@'))return null;
  const named=text(row.LogonError);
  const raw=String(row.ErrorCode??'').trim();
  let code=/^\d+$/.test(raw)?Number(raw):codes[named.toLowerCase()]??null;
  // Operation alone can describe a failed token request. Unknown is never success.
  if(code===null&&row.Operation==='UserLoggedIn'&&/^(Success|Succeeded)$/i.test(String(row.ResultStatus))&&!named)code=0;
  if(row.Operation==='UserLoginFailed'&&code===0)code=null;
  if(code===0&&/^(Failed|Failure)$/i.test(String(row.ResultStatus)))code=null;
  if(named&&code===0)code=codes[named.toLowerCase()]??null;
  const user=users.get(upn);
  const key=text(row.Id)||createHash('sha256').update(JSON.stringify([row.Operation,rawTime,upn,row.ClientIP,row.ApplicationId,raw,named])).digest('hex');
  return {id:'audit:'+key,userId:user?.id||'audit-upn:'+upn,userPrincipalName:upn,userDisplayName:user?.displayName||upn,createdDateTime:new Date(time).toISOString(),ipAddress:normalizeIp(row.ClientIP)||text(row.ClientIP),appDisplayName:applicationName(text(row.ApplicationName||row.ApplicationDisplayName||row.ApplicationId)),status:{errorCode:code,failureReason:named||(code===null?'Audit sonucu bilinmiyor':'')},location:{},_source:'m365-audit',operation:row.Operation};
}

export class Audit {
  constructor(connection,{fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){this.connection=connection;this.fetcher=fetcher;this.sleep=sleep;this.prefix=`/api/v1.0/${connection.tenantId.toLowerCase()}/activity/feed/`;}
  safeUrl(value){const u=new URL(value,root);if(u.origin!==root||u.username||u.password||!u.pathname.toLowerCase().startsWith(this.prefix))throw new AuditError('Audit sayfalama/paket adresi güvenilir tenant adresi değil.');return u.href;}
  url(path,params={}){return root+this.prefix+path+'?'+new URLSearchParams({PublisherIdentifier:this.connection.tenantId,...params});}
  async tokenValue(){
    if(this.token&&this.expires>Date.now()+60000)return this.token;
    const c=this.connection;
    const r=await this.fetcher(`https://login.microsoftonline.com/${c.tenantId}/oauth2/v2.0/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),body:new URLSearchParams({client_id:c.clientId,client_secret:c.secret,grant_type:'client_credentials',scope:root+'/.default'})});
    const b=await r.json();if(!r.ok||!b.access_token)throw new AuditError('M365 Audit kimlik doğrulaması başarısız. Client ID ve secret değerini/süresini kontrol edin.');
    this.token=b.access_token;this.expires=Date.now()+(Number(b.expires_in)||3600)*1000;return this.token;
  }
  async request(url,method='GET'){
    url=this.safeUrl(url);
    for(let attempt=0;attempt<4;attempt++){
      let r;
      try{r=await this.fetcher(url,{method,headers:{Authorization:`Bearer ${await this.tokenValue()}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(120000)});}
      catch(e){if(e instanceof AuditError)throw e;if(attempt===3)throw new AuditError('M365 Audit ağına ulaşılamadı veya istek zaman aşımına uğradı.');await this.sleep(1000*2**attempt);continue;}
      if(r.status===401&&attempt===0){this.token=null;continue;}
      if(r.status===429||r.status>=500){
        if(attempt===3)throw new AuditError('M365 Audit geçici hata/istek sınırı döndürdü. Sonraki eşitlemede yeniden denenecek.');
        const h=r.headers.get('retry-after'),ms=h?(/^\d+$/.test(h)?Number(h)*1000:Date.parse(h)-Date.now()):1000*2**attempt;
        if(ms>120000)throw new AuditError('M365 Audit daha uzun bekleme istiyor. Sonraki eşitlemede yeniden denenecek.');
        await this.sleep(Math.max(1000,ms||1000));continue;
      }
      if(r.status===403)throw new AuditError('M365 Audit erişimi reddedildi. Office 365 Management APIs → ActivityFeed.Read uygulama izni, yönetici onayı ve Audit Standard erişimini kontrol edin.');
      if(r.status===401){
        const detail=await r.json().catch(()=>({}));
        const code=detail.error?.code||detail.code;
        throw new AuditError(code==='AF10001'?'M365 Audit izni token içinde bulunmuyor (AF10001). API aracılığıyla bağla düğmesi ActivityFeed.Read iznini otomatik tamamlar.':'M365 Audit HTTP 401: API kimliği veya izni kabul edilmedi. API aracılığıyla bağla düğmesiyle kurulumu yenileyin; yeni izinlerin Microsoft tarafında yayılması birkaç dakika sürebilir.');
      }
      if(!r.ok)throw new AuditError(`M365 Audit HTTP ${r.status} döndürdü. Purview denetiminin açık olduğunu ve uygulama izinlerini kontrol edin.`);
      const body=await r.text();return {data:body?JSON.parse(body):null,next:r.headers.get('NextPageUri')||r.headers.get('NextPageURL')};
    }
    throw new AuditError('M365 Audit isteği tamamlanamadı.');
  }
  async collect({users=[],previous={},initialDays=7,now=Date.now(),progress=()=>{}}={}){
    progress('M365 Audit içerik aboneliği kontrol ediliyor');
    const subscriptions=(await this.request(this.url('subscriptions/list'))).data;
    if(!Array.isArray(subscriptions))throw new AuditError('Audit abonelik listesi beklenmeyen biçimde.');
    if(!subscriptions.some(s=>s.contentType==='Audit.AzureActiveDirectory'&&String(s.status).toLowerCase()==='enabled')){
      await this.request(this.url('subscriptions/start',{contentType:'Audit.AzureActiveDirectory'}),'POST');
      return {events:[],state:{...previous},waiting:true,message:'Audit aboneliği etkinleştirildi. İlk paketlerin oluşması 12 saate kadar sürebilir; zamanlanmış eşitleme tekrar kontrol edecek.'};
    }
    const earliest=now-7*day+120000;
    const cursor=Date.parse(previous.until);
    const start=Math.max(earliest,Number.isFinite(cursor)?cursor-day:now-Math.min(initialDays,7)*day+120000);
    const blobs=new Map(),visited=new Set();
    for(let from=start;from<now;from+=day){
      let url=this.url('subscriptions/content',{contentType:'Audit.AzureActiveDirectory',startTime:new Date(from).toISOString(),endTime:new Date(Math.min(from+day,now)).toISOString()});
      while(url){
        url=this.safeUrl(url);if(visited.has(url)||visited.size>=10000)throw new AuditError('Audit sayfalama sınırına ulaşıldı. Kısmi veri kaydedilmedi.');visited.add(url);
        const result=await this.request(url);if(!Array.isArray(result.data))throw new AuditError('Audit paket listesi beklenmeyen biçimde.');
        for(const b of result.data){if(!b.contentId||!b.contentUri)throw new AuditError('Audit paket kimliği/adresi eksik.');blobs.set(b.contentId,{...b,contentUri:this.safeUrl(b.contentUri)});}
        url=result.next;progress(`${blobs.size} M365 Audit paketi listelendi`);
      }
    }
    const processed=Object.fromEntries(Object.entries(previous.processed||{}).filter(([,v])=>Number(v)>=earliest));
    const pending=[...blobs.values()].filter(b=>!processed[b.contentId]);
    const directory=new Map(users.map(u=>[String(u.userPrincipalName||'').toLowerCase(),u]));
    const events=new Map();let done=0,skipped=0;
    // Bounded concurrency, with all results settled before publishing or reporting error.
    for(let i=0;i<pending.length;i+=3){
      const results=await Promise.allSettled(pending.slice(i,i+3).map(async b=>{
        const rows=(await this.request(b.contentUri)).data;if(!Array.isArray(rows))throw new AuditError('Audit paketi olay listesi içermiyor.');
        const normalized=[];for(const row of rows){const e=normalizeAudit(row,directory,this.connection.tenantId);if(e&&Date.parse(e.createdDateTime)>=now-30*day&&Date.parse(e.createdDateTime)<=now+300000)normalized.push(e);else skipped++;}
        return {b,normalized};
      }));
      for(const r of results){if(r.status==='rejected')throw r.reason;for(const e of r.value.normalized)events.set(e.id,e);processed[r.value.b.contentId]=now;done++;}
      if(events.size>500000||Object.keys(processed).length>50000)throw new AuditError('Audit yerel kapasite sınırına ulaşıldı; kısmi veri kaydedilmedi.');
      progress(`M365 Audit: ${done}/${pending.length} paket · ${events.size} giriş olayı`);
    }
    return {events:[...events.values()],state:{until:new Date(now).toISOString(),since:previous.since||new Date(start).toISOString(),processed},waiting:false,packages:pending.length,skipped,message:pending.length?`${events.size} giriş olayı işlendi.`:'Henüz yeni Audit paketi yok; kaynak gecikmeli olabilir.'};
  }
}
