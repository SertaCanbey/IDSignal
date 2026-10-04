const invalid=message=>Object.assign(new Error(message),{status:400});
const text=(value,max=500)=>typeof value==='string'?value.slice(0,max):'';
export function parseSignInImport(document,{now=Date.now()}={}) {
  const rows=Array.isArray(document)?document:document?.value;
  if(!Array.isArray(rows))throw invalid('JSON, bir giriş kaydı listesi veya value alanında liste içermeli. Portaldan tam Sign-in logs JSON dosyasını indirin.');
  if(rows.length>100000)throw invalid('Bir dosyada en fazla 100.000 olay aktarılabilir. Tarih aralığını daraltın.');
  const events=new Map();let expired=0;
  for(let index=0;index<rows.length;index++) {
    const e=rows[index],time=Date.parse(e?.createdDateTime),code=e?.status?.errorCode;
    if(!e||typeof e.id!=='string'||!e.id.trim()||e.id.length>200||typeof e.userId!=='string'||!e.userId.trim()||e.userId.length>200||typeof e.createdDateTime!=='string'||!/(Z|[+-]\d{2}:\d{2})$/i.test(e.createdDateTime)||!Number.isFinite(time)||typeof code!=='number'||!Number.isInteger(code)||code<0)throw invalid(`${index+1}. kayıt geçersiz. id, userId, saat dilimli createdDateTime ve sayısal status.errorCode gerekli. Yalnızca kullanıcı girişlerinin tam JSON dosyası desteklenir.`);
    if(time>now+300000)throw invalid(`${index+1}. kayıt gelecekte görünüyor; dosyanın tarihlerini kontrol edin.`);
    if(time<now-30*86400000){expired++;continue;}
    events.set(e.id,{id:e.id,userId:e.userId,createdDateTime:new Date(time).toISOString(),userDisplayName:text(e.userDisplayName),userPrincipalName:text(e.userPrincipalName),ipAddress:text(e.ipAddress,100),appDisplayName:text(e.appDisplayName),status:{errorCode:code,failureReason:text(e.status.failureReason)},location:{countryOrRegion:text(e.location?.countryOrRegion,100)},_source:'portal-import'});
  }
  return {events:[...events.values()],total:rows.length,expired,duplicates:rows.length-expired-events.size};
}
