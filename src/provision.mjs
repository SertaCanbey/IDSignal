import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const guid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export class SetupError extends Error {}
export async function withAzureLogin({tenantId,signal,progress},work){
  const cache=mkdtempSync(join(tmpdir(),'IDSignal-login-'));
  const command=args=>new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('../scripts/azure-command.ps1',import.meta.url))],{
      windowsHide:true,env:{...process.env,AZURE_CONFIG_DIR:cache,AZURE_CORE_ENABLE_BROKER_ON_WINDOWS:'false',AZURE_CORE_LOGIN_EXPERIENCE_V2:'off',AZURE_CORE_COLLECT_TELEMETRY:'false'},stdio:['pipe','pipe','pipe']});
    const abort=()=>{if(child.pid)spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('error',()=>child.kill());};
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    let output='',error='';
    child.stdout.on('data',b=>{output+=b;if(output.length>1024*1024)child.kill();});
    child.stderr.on('data',b=>{error=(error+b).slice(-16000);});
    child.on('error',()=>reject(new SetupError('Microsoft giriş işlemi başlatılamadı veya süresi doldu. Yeniden deneyin.')));
    child.on('close',code=>{signal?.removeEventListener('abort',abort);code===0?resolve(output):reject(new SetupError(error.includes('IR_CLI_MISSING')?'Azure CLI bu bilgisayarda bulunamadı. Azure CLI kurulumu gerekli.':'Microsoft girişi tamamlanamadı. Yetkili yönetici hesabıyla yeniden deneyin.'));});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({args}));
  });
  try{
    progress('Microsoft giriş ekranı açılıyor. Yönetici hesabınızla giriş yapın.');
    await command(['login',...(tenantId?['--tenant',tenantId]:[]),'--allow-no-subscriptions','--output','none']);
    const token=JSON.parse(await command(['account','get-access-token','--resource-type','ms-graph',...(tenantId?['--tenant',tenantId]:[]),'--output','json']));
    if(!guid.test(token.tenant||'')||!token.accessToken||(tenantId&&token.tenant.toLowerCase()!==tenantId.toLowerCase()))throw new SetupError('Microsoft hesabının kuruluşu seçili tenant ile eşleşmiyor.');
    return await work({tenantId:token.tenant.toLowerCase(),accessToken:token.accessToken});
  }finally{rmSync(cache,{recursive:true,force:true,maxRetries:3});}
}

// Delegated administrator access is held only for setup. The collector receives
// exactly the required read-only application roles, never the administrator's token.
export async function provision({tenantId,clientId,accessToken,signal,progress,checkpoint,fetcher=fetch}){
  const request=async(path,method='GET',body)=>{
    const response=await fetcher('https://graph.microsoft.com/v1.0/'+path,{method,redirect:'error',signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(30000)]),headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(!response.ok){
      if(response.status===403)throw new SetupError('Bu hesap uygulama oluşturma veya yönetici onayı verme yetkisine sahip değil. Global Administrator ya da uygun yetkili yönetici hesabıyla yeniden giriş yapın.');
      throw new SetupError(`Microsoft uygulama kurulumu HTTP ${response.status} döndürdü. Oluşturulmuş kayıt korunuyor; aynı düğmeyle yeniden deneyebilirsiniz.`);
    }
    return response.status===204?null:response.json();
  };
  progress('Uygulama kaydı ve salt okunur API izinleri hazırlanıyor.');
  const resources=[];
  for(const [filter,permission] of [["appId eq '00000003-0000-0000-c000-000000000000'",'User.Read.All'],["appId eq '00000003-0000-0000-c000-000000000000'",'UserAuthenticationMethod.Read.All'],["servicePrincipalNames/any(n:n eq 'https://manage.office.com')",'ActivityFeed.Read']]){
    const result=await request('servicePrincipals?'+new URLSearchParams({'$filter':filter}));
    if(result.value?.length!==1)throw new SetupError('Microsoft API kaydı tenant içinde bulunamadı veya belirsiz.');
    const resource=result.value[0],role=resource.appRoles?.find(r=>r.value===permission&&r.isEnabled&&r.allowedMemberTypes?.includes('Application'));
    if(!role)throw new SetupError(`Microsoft API izni bulunamadı: ${permission}`);
    resources.push({resource,role});
  }
  let app;
  if(clientId){
    if(!guid.test(clientId))throw new SetupError('Uygulama kimliği geçersiz.');
    const result=await request('applications?'+new URLSearchParams({'$filter':`appId eq '${clientId}'`}));
    app=result.value?.[0];if(!app)throw new SetupError('Bağlı uygulama bu tenant içinde bulunamadı.');
  }else{
    app=await request('applications','POST',{displayName:'IDSignal API',signInAudience:'AzureADMyOrg'});
    await checkpoint({tenantId,clientId:app.appId});
  }
  const access=structuredClone(app.requiredResourceAccess||[]);
  for(const {resource,role} of resources){
    let entry=access.find(x=>x.resourceAppId===resource.appId);
    if(!entry){entry={resourceAppId:resource.appId,resourceAccess:[]};access.push(entry);}
    if(!entry.resourceAccess.some(x=>x.id===role.id))entry.resourceAccess.push({id:role.id,type:'Role'});
  }
  await request(`applications/${app.id}`,'PATCH',{requiredResourceAccess:access});
  const result=await request('servicePrincipals?'+new URLSearchParams({'$filter':`appId eq '${app.appId}'`}));
  const principal=result.value?.[0]||await request('servicePrincipals','POST',{appId:app.appId});
  const assigned=(await request(`servicePrincipals/${principal.id}/appRoleAssignments`)).value;
  progress('Yönetici yetkinizle kullanıcı, MFA yöntemi ve Audit okuma izinleri onaylanıyor.');
  for(const {resource,role} of resources){
    if(!assigned.some(x=>x.resourceId===resource.id&&x.appRoleId===role.id))await request(`servicePrincipals/${resource.id}/appRoleAssignedTo`,'POST',{principalId:principal.id,resourceId:resource.id,appRoleId:role.id});
  }
  return {tenantId,clientId:app.appId,createSecret:async()=>{
    const endDateTime=new Date(Date.now()+365*86400000).toISOString();
    const credential=await request(`applications/${app.id}/addPassword`,'POST',{passwordCredential:{displayName:'IDSignal collector',endDateTime}});
    if(!credential.secretText)throw new SetupError('Microsoft bağlantı sırrı oluşturulamadı.');
    return credential.secretText;
  }};
}
