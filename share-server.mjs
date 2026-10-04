import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyze} from './src/analysis.mjs';
const here=dirname(fileURLToPath(import.meta.url));
export function createShareServer({dataDir=join(process.env.LOCALAPPDATA,'IDSignal','data'),host='192.168.60.178',port=4318,credential}={}){
  credential ||= JSON.parse(readFileSync(join(dataDir,'share-login.json'),'utf8'));
  if(!/^[a-f0-9]{64}$/.test(credential.salt)||!/^[a-f0-9]{128}$/.test(credential.hash))throw Error('Paylaşım parolası yapılandırılmamış.');
  const db=new DatabaseSync(join(dataDir,'IDSignal.db'),{readOnly:true});
  const sessions=new Map(),attempts=new Map(),origin='http://'+host+':'+port;
  const get=(key,fallback)=>{const row=db.prepare('SELECT value FROM settings WHERE key=?').get(key);return row?JSON.parse(row.value):fallback;};
  const token=()=>randomBytes(32).toString('hex');
  const status=session=>{
    if(!session)return {initialized:true,authenticated:false,readOnly:true};
    const cfg=get('config',{}),s=get('sync',{}),c=get('connection',{}),mode=cfg.mode||'premium';
    const sync={};for(const k of ['lastSuccess','lastDirectorySuccess','lastAttempt','auditLastSuccess','auditWaiting','since','mode'])sync[k]=s[k];
    sync.error=s.error?'Son veri toplama tamamlanamadı. Yöneticiye başvurun.':null;
    sync.auditMessage=s.auditWaiting?'Audit aboneliği etkin; ilk veri paketleri bekleniyor.':s.auditLastSuccess?'Son toplanan Audit verileri gösteriliyor.':null;
    return {initialized:true,authenticated:true,readOnly:true,csrf:session.csrf,connection:{verified:!!c.verified,directoryVerified:!!c.directoryVerified},config:{mode},sync,import:{lastImport:get('import',{}).lastImport}};
  };
  const json=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if(req.headers.host!==host+':'+port)return json(res,403,{error:'Geçersiz adres.'});
    try{
      const u=new URL(req.url,origin),path=u.pathname;
      const id=/\bir_share_session=([a-f0-9]{64})\b/.exec(req.headers.cookie||'')?.[1];
      let session=sessions.get(id);if(session?.expires<=Date.now()){sessions.delete(id);session=null;}
      if(req.method==='GET'&&path==='/api/status')return json(res,200,status(session));
      if(req.method==='POST'&&['/api/login','/api/logout'].includes(path)){
        if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'İstek kaynağı geçersiz.'});
        if(path==='/api/logout'){
          if(!session||req.headers['x-csrf-token']!==session.csrf)return json(res,403,{error:'Oturum geçersiz.'});
          sessions.delete(id);res.setHeader('Set-Cookie','ir_share_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});
        }
        for(const [key,item] of attempts)if(item.until<Date.now())attempts.delete(key);
        const address=req.socket.remoteAddress,limit=attempts.get(address);
        if(limit?.count>=5||attempts.size>=10000)return json(res,429,{error:'Çok fazla deneme. 15 dakika sonra tekrar deneyin.'});
        let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2048)return json(res,413,{error:'İstek çok büyük.'});chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return json(res,400,{error:'Geçersiz JSON.'});}
        if(typeof body.password!=='string'||body.password.length>128||!timingSafeEqual(scryptSync(body.password,credential.salt,64),Buffer.from(credential.hash,'hex'))){
          attempts.set(address,{count:(limit?.count||0)+1,until:limit?.until||Date.now()+900000});return json(res,401,{error:'Paylaşım parolası hatalı.'});
        }
        attempts.delete(address);for(const [key,item] of sessions)if(item.expires<Date.now())sessions.delete(key);
        if(sessions.size>=1000)return json(res,429,{error:'Oturum sınırına ulaşıldı.'});
        const newId=token();session={csrf:token(),expires:Date.now()+8*3600000};sessions.set(newId,session);
        res.setHeader('Set-Cookie','ir_share_session='+newId+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800');return json(res,200,status(session));
      }
      if(req.method!=='GET')return json(res,403,{error:'Paylaşım ekranı salt okunurdur.'});
      if(path==='/api/dashboard'){
        if(!session)return json(res,401,{error:'Oturum açmanız gerekiyor.'});
        const days=Number(u.searchParams.get('days')||7);if(![1,7,30].includes(days))return json(res,400,{error:'Geçersiz dönem.'});
        const view=status(session),mode=view.config.mode,since=new Date(Date.now()-days*86400000).toISOString();
        const events=db.prepare('SELECT value FROM events WHERE time>=?').all(since).map(r=>JSON.parse(r.value)).filter(e=>mode==='m365'?e._source==='m365-audit':e._source!=='m365-audit');
        const data=analyze(get('users',[]),mode==='premium'?get('mfa',[]):[],events);
        return json(res,200,{...data,days,since,mode,import:view.import,sync:view.sync});
      }
      const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/logo.png':['logo.png','image/png']};
      if(!files[path])return json(res,404,{error:'Sayfa bulunamadı.'});
      const [file,type]=files[path];res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(readFileSync(join(here,'public',file)));
    }catch{return json(res,503,{error:'Paylaşım verileri şu anda alınamıyor.'});}
  });
  server.on('close',()=>db.close());return server;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const host=process.env.SHARE_HOST||'192.168.60.178',port=Number(process.env.SHARE_PORT||4318);
  createShareServer({host,port}).listen(port,host,()=>console.log('IDSignal paylaşımı hazır.'));
}

