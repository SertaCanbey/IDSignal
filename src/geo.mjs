import {normalizeIp,isPrivateIp} from './network.mjs';

const successAge=180*86400000, failureAge=3600000;
export class GeoResolver{
  constructor(store,{fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){this.store=store;this.fetcher=fetcher;this.sleep=sleep;this.pending=new Map();this.tail=Promise.resolve();}
  cached(value){
    const ip=normalizeIp(value);if(!ip)return null;
    if(isPrivateIp(ip))return {ip,countryOrRegion:'Özel ağ',countryCode:'LAN',city:'',source:'local'};
    const row=this.store.getGeo(ip);if(!row)return null;
    const age=Date.now()-Date.parse(row.checkedAt);return age<(row.success?successAge:failureAge)?row:null;
  }
  async lookup(value){
    const ip=normalizeIp(value);if(!ip)throw Object.assign(new Error('Geçerli bir IP adresi gerekli.'),{status:400});
    const cached=this.cached(ip);if(cached)return cached;
    if(this.pending.has(ip))return this.pending.get(ip);
    const job=this.tail.then(async()=>{
      let result={ip,success:false,countryOrRegion:'',countryCode:'',city:'',checkedAt:new Date().toISOString(),source:'ipwho.is'};
      try{
        const response=await this.fetcher('https://ipwho.is/'+encodeURIComponent(ip),{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});
        const body=await response.json();
        if(response.ok&&body?.success===true&&typeof body.country==='string')result={...result,success:true,countryOrRegion:body.country.slice(0,100),countryCode:String(body.country_code||'').slice(0,3),city:String(body.city||'').slice(0,100)};
      }catch{}
      this.store.setGeo(ip,result);await this.sleep(100);return result;
    });
    this.tail=job.catch(()=>{});this.pending.set(ip,job);
    try{return await job;}finally{this.pending.delete(ip);}
  }
}
