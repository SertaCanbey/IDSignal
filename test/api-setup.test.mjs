import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {provision} from '../src/provision.mjs';
import {createApp} from '../server.mjs';
const tenant='11111111-1111-1111-1111-111111111111',client='22222222-2222-2222-2222-222222222222';

test('API setup merges requested permissions and grants only the three required roles; repeat is idempotent',async()=>{
  const assignments=[],calls=[];
  const resources=[{id:'graph',appId:'graph-app',appRoles:[{id:'user-role',value:'User.Read.All',allowedMemberTypes:['Application'],isEnabled:true},{id:'mfa-role',value:'UserAuthenticationMethod.Read.All',allowedMemberTypes:['Application'],isEnabled:true}]},{id:'audit',appId:'audit-app',appRoles:[{id:'audit-role',value:'ActivityFeed.Read',allowedMemberTypes:['Application'],isEnabled:true}]}];
  let app={id:'app-object',appId:client,requiredResourceAccess:[{resourceAppId:'other',resourceAccess:[{id:'preserved',type:'Role'}]}]};
  const fetcher=async(url,opts)=>{
    const u=new URL(url),path=u.pathname.replace('/v1.0/',''),b=opts.body&&JSON.parse(opts.body);calls.push([path,opts.method,b]);
    if(path==='applications')return Response.json({value:[app]});
    if(path==='applications/app-object'){app={...app,...b};return new Response(null,{status:204});}
    if(path==='servicePrincipals'){
      const filter=u.searchParams.get('$filter');return Response.json({value:filter.includes('00000003')?[resources[0]]:filter.includes('manage.office.com')?[resources[1]]:[{id:'principal'}]});
    }
    if(path==='servicePrincipals/principal/appRoleAssignments')return Response.json({value:assignments});
    if(path.endsWith('/appRoleAssignedTo')){assignments.push(b);return Response.json(b,{status:201});}
    throw Error('Unexpected '+path);
  };
  const args={tenantId:tenant,clientId:client,accessToken:'delegated-never-save',fetcher,progress:()=>{},checkpoint:()=>assert.fail('Existing app must not be recreated')};
  await provision(args);await provision(args);
  assert.equal(assignments.length,3);assert.deepEqual(assignments.map(x=>x.appRoleId),['user-role','mfa-role','audit-role']);
  assert.equal(app.requiredResourceAccess[0].resourceAccess[0].id,'preserved');
  assert.ok(!calls.some(([p])=>p.includes('addPassword')));
});

test('one-button endpoint enforces auth, CSRF, setup mutex, automatic sync and no token disclosure',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ir-auto-')),origin='http://localhost:4336';let finish,started=false;
  const gate=new Promise(r=>finish=r);
  const app=createApp({dataDir:dir,origin,scheduled:false,setupLogin:async(opts,work)=>{started=true;await gate;return work({tenantId:tenant,accessToken:'delegated-secret'});},setupProvision:async opts=>{assert.equal(opts.clientId,client);return {tenantId:tenant,clientId:client,createSecret:()=>assert.fail('Do not rotate existing secret')};},fetcher:async url=>{
    if(url.includes('/token'))return Response.json({access_token:'fake'});
    if(url.includes('/users?'))return Response.json({value:[]});
    if(url.includes('/subscriptions/list'))return Response.json([{contentType:'Audit.AzureActiveDirectory',status:'enabled'}]);
    if(url.includes('/subscriptions/content'))return Response.json([]);
    throw Error('Unexpected endpoint');
  }});
  await new Promise(r=>app.server.listen(4336,'127.0.0.1',r));let cookie='',csrf='';
  const req=(path,b,headers={})=>fetch(origin+path,{method:b===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,...headers},body:b===undefined?undefined:JSON.stringify(b)});
  try{
    assert.equal((await req('/api/connect-api',{})).status,401);
    const r=await req('/api/setup',{password:'api setup test password'});cookie=r.headers.get('set-cookie').split(';')[0];csrf=(await r.json()).csrf;
    await req('/api/connection',{tenantId:tenant,clientId:client,secret:'collector-secret'});
    assert.equal((await req('/api/connect-api',{}, {'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await req('/api/connect-api',{})).status,202);assert.equal(started,true);
    assert.equal((await req('/api/connect-api',{})).status,409);
    assert.equal((await req('/api/disconnect',{})).status,409);
    finish();
    for(let i=0;i<100&&!app.store.get('sync')?.auditLastSuccess;i++)await new Promise(r=>setTimeout(r,10));
    const state=await(await req('/api/status')).json();
    assert.equal(state.config.mode,'m365');assert.ok(state.sync.auditLastSuccess);assert.equal(state.apiSetup.active,false);
    assert.ok(!JSON.stringify(state).includes('secret'));assert.ok(!JSON.stringify(app.store.get('connection')).includes('collector-secret'));
    assert.equal(app.store.decrypt(app.store.get('connection').secret),'collector-secret');
  }finally{finish();await new Promise(r=>app.server.close(r));rmSync(dir,{recursive:true,force:true});}
});

test('permission denial is actionable and never leaks Microsoft error payload',async()=>{
  await assert.rejects(provision({tenantId:tenant,clientId:client,accessToken:'private',progress:()=>{},fetcher:async()=>Response.json({secret:'private'}, {status:403})}),e=>e.message.includes('Global Administrator')&&!e.message.includes('private'));
});
