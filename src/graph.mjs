const ROOT = 'https://graph.microsoft.com/v1.0/';
export class GraphError extends Error { constructor(message) { super(message); this.name='GraphError'; } }
export function safeGraphUrl(value) {
  const u = new URL(value, ROOT);
  if (u.origin !== 'https://graph.microsoft.com' || !u.pathname.startsWith('/v1.0/') || u.username || u.password) throw new GraphError('Graph sayfalama adresi geçersiz.');
  return u.href;
}
export class Graph {
  constructor(connection, {fetcher=fetch, sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}) { this.connection=connection; this.fetcher=fetcher; this.sleep=sleep; this.token=null; }
  async tokenValue() {
    if (this.token && this.expires>Date.now()+60000) return this.token;
    const c=this.connection;
    const r=await this.fetcher(`https://login.microsoftonline.com/${c.tenantId}/oauth2/v2.0/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),body:new URLSearchParams({client_id:c.clientId,client_secret:c.secret,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'})});
    const b=await r.json();
    if(!r.ok || !b.access_token) throw new GraphError('Microsoft kimlik doğrulaması başarısız. Tenant ID, Client ID ve secret değerini/süresini kontrol edin.');
    this.token=b.access_token; this.expires=Date.now()+(Number(b.expires_in)||3600)*1000; return this.token;
  }
  async page(url) {
    url=safeGraphUrl(url);
    for(let attempt=0;attempt<5;attempt++) {
      let r;
      try { r=await this.fetcher(url,{headers:{Authorization:`Bearer ${await this.tokenValue()}`},redirect:'error',signal:AbortSignal.timeout(30000)}); }
      catch(e) { if(e instanceof GraphError) throw e; if(attempt===4) throw new GraphError('Microsoft Graph bağlantısı zaman aşımına uğradı veya ağ erişimi yok.'); await this.sleep(1000*2**attempt); continue; }
      if(r.status===401 && attempt===0) {this.token=null;continue;}
      if(r.status===429 || r.status>=500) {
        if(attempt===4) throw new GraphError('Microsoft Graph geçici olarak erişilemiyor veya istek sınırına ulaşıldı. Daha sonra tekrar deneyin.');
        const header=r.headers.get('retry-after');
        const delay=header ? (/^\d+$/.test(header) ? Number(header)*1000 : Date.parse(header)-Date.now()) : 1000*2**attempt;
        if(delay>120000) throw new GraphError('Graph uzun bekleme süresi istiyor. Sonraki zamanlanmış eşitlemede yeniden denenecek.');
        await this.sleep(Math.max(1000,Math.min(120000,delay||1000))); continue;
      }
      if(r.status===403) {
        const path=new URL(url).pathname;
        let detail={};try{detail=await r.json();}catch{}
        const license=/premium|licen[cs]e|nonpremium/i.test(String(detail.error?.code||'')+' '+String(detail.error?.message||''));
        const source=path.includes('userRegistrationDetails')?'MFA kayıt raporu':path.includes('signIns')?'Giriş günlükleri':'Kullanıcı dizini';
        if(license)throw new GraphError(`${source}: Microsoft lisans gereksinimi nedeniyle erişimi reddetti. P1/P2 yoksa bağlantı ekranından ücretsiz modu seçin.`);
        throw new GraphError(`${source}: Graph erişimi reddedildi (403). ${source==='Kullanıcı dizini'?'User.Read.All':'AuditLog.Read.All'} uygulama iznini ve yönetici onayını kontrol edin.${source==='Kullanıcı dizini'?' Bu dizin isteği için P1/P2 gerekmez.':' Bu raporun lisans koşulları da geçerlidir; 403 tek başına lisans eksikliğini kanıtlamaz.'}`);
      }
      if(!r.ok) throw new GraphError(`Graph isteği tamamlanamadı (HTTP ${r.status}). Bağlantı izinlerini kontrol edin.`);
      return r.json();
    }
    throw new GraphError('Graph isteği tamamlanamadı.');
  }
  async list(path, progress=()=>{}) {
    const all=[], visited=new Set(); let url=safeGraphUrl(path);
    while(url) {
      if(visited.has(url) || visited.size>=10000) throw new GraphError('Sayfalama güvenlik sınırına ulaşıldı; kısmi veriler kaydedilmedi.');
      visited.add(url); const page=await this.page(url);
      if(!Array.isArray(page.value)) throw new GraphError('Graph beklenmeyen veri döndürdü.');
      all.push(...page.value); progress(all.length);
      if(all.length>500000) throw new GraphError('Yerel sürümün 500.000 kayıt sınırı aşıldı; zaman aralığını azaltın.');
      url=page['@odata.nextLink'] ? safeGraphUrl(page['@odata.nextLink']) : null;
    }
    return all;
  }
  async authenticationRegistrations(users, progress=()=>{}) {
    const registrations=[];
    // Microsoft Graph allows at most 20 requests in one JSON batch. A one-second
    // pause between batches prevents the authentication-method service burst
    // that previously left the whole tenant at "unknown".
    const batchSize=20;
    for(let offset=0;offset<users.length;offset+=batchSize){
      let pending=users.slice(offset,offset+batchSize).map((user,index)=>({user,id:String(offset+index)}));
      for(let attempt=0;pending.length&&attempt<8;attempt++){
        const lookup=new Map(pending.map(item=>[item.id,item.user]));
        const response=await this.post('$batch',{requests:pending.map(item=>({id:item.id,method:'GET',url:`/users/${encodeURIComponent(item.user.id)}/authentication/methods`}))});
        if(!Array.isArray(response.responses))throw new GraphError('MFA yöntemleri beklenmeyen veri döndürdü.');
        const retry=[],seen=new Set();let retryAfter=0;
        for(const item of response.responses){
          const user=lookup.get(String(item.id));if(!user)throw new GraphError('MFA yöntemleri kullanıcı eşleştirmesi bozuk.');
          if(seen.has(String(item.id)))throw new GraphError('MFA yöntemleri yinelenen kullanıcı yanıtı döndürdü.');seen.add(String(item.id));
          if(item.status===403)throw new GraphError('MFA yöntemleri: Graph erişimi reddedildi (403). UserAuthenticationMethod.Read.All uygulama iznini yönetici hesabıyla onaylayın.');
          if(item.status===429){retry.push({user,id:String(item.id)});retryAfter=Math.max(retryAfter,Number(item.headers?.['Retry-After']||item.headers?.['retry-after']||0)*1000);continue;}
          if(item.status===404){registrations.push({id:user.id,isMfaRegistered:null,isMfaCapable:null});continue;}
          if(item.status!==200||!Array.isArray(item.body?.value))throw new GraphError(`MFA yöntemleri alınamadı (HTTP ${item.status||'?'})`);
          const types=item.body.value.map(method=>String(method['@odata.type']||'').split('.').at(-1));
          const mfa=types.some(type=>type&&!['passwordAuthenticationMethod','emailAuthenticationMethod','temporaryAccessPassAuthenticationMethod'].includes(type));
          registrations.push({id:user.id,isMfaRegistered:mfa,isMfaCapable:mfa,methodCount:types.length});
        }
        if(seen.size!==lookup.size)throw new GraphError('MFA yöntemleri bazı kullanıcı yanıtlarını döndürmedi.');
        pending=retry;
        if(pending.length)await this.sleep(Math.max(1000,retryAfter||1000*2**attempt));
      }
      if(pending.length)throw new GraphError('MFA yöntemleri istek sınırı sekiz denemede aşılamadı. Sonraki eşitlemede yeniden denenecek.');
      progress(Math.min(offset+batchSize,users.length));
      if(offset+batchSize<users.length)await this.sleep(1000);
    }
    return registrations;
  }
  async post(path,body){
    const url=safeGraphUrl(path);
    for(let attempt=0;attempt<5;attempt++){
      let response;
      try{response=await this.fetcher(url,{method:'POST',headers:{Authorization:`Bearer ${await this.tokenValue()}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});}
      catch(e){if(e instanceof GraphError)throw e;if(attempt===4)throw new GraphError('Microsoft Graph bağlantısı zaman aşımına uğradı.');await this.sleep(1000*2**attempt);continue;}
      if(response.status===401&&attempt===0){this.token=null;continue;}
      if(response.status===429||response.status>=500){if(attempt===4)throw new GraphError('Microsoft Graph geçici olarak erişilemiyor veya istek sınırına ulaşıldı.');await this.sleep(1000*2**attempt);continue;}
      if(response.status===403)throw new GraphError('MFA yöntemleri: Graph erişimi reddedildi (403). UserAuthenticationMethod.Read.All uygulama iznini yönetici hesabıyla onaylayın.');
      if(!response.ok)throw new GraphError(`Graph isteği tamamlanamadı (HTTP ${response.status}).`);
      return response.json();
    }
  }
}
