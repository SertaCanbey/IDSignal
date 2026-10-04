import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Audit,normalizeAudit} from '../src/audit.mjs';
import {createApp} from '../server.mjs';
const tenant='11111111-1111-1111-1111-111111111111',client='22222222-2222-2222-2222-222222222222';
const connection={tenantId:tenant,clientId:client,secret:'test-secret'};
const base=`https://manage.office.com/api/v1.0/${tenant}/activity/feed/`;
const row={Id:'one',OrganizationId:tenant,Operation:'UserLoginFailed',UserId:'USER@example.test',CreationTime:new Date(Date.now()-60000).toISOString(),ClientIP:'192.0.2.1',LogonError:'InvalidUserNameOrPassword'};
test('audit normalization preserves unknown/MFA outcomes and matches directory users',()=>{
  const users=new Map([['user@example.test',{id:'directory-id',displayName:'Test'}]]);
  const e=normalizeAudit(row,users,tenant);assert.equal(e.userId,'directory-id');assert.equal(e.status.errorCode,50126);assert.equal(e._source,'m365-audit');
  assert.equal(normalizeAudit({...row,ApplicationId:'00000002-0000-0ff1-ce00-000000000000'},users,tenant).appDisplayName,'Office 365 Exchange Online');
  assert.equal(normalizeAudit({...row,LogonError:'UserStrongAuthClientAuthNRequired'},users,tenant).status.errorCode,50076);
  assert.equal(normalizeAudit({...row,LogonError:'UnknownFailure',ErrorCode:0},users,tenant).status.errorCode,null);
  assert.equal(normalizeAudit({...row,Operation:'UserLoggedIn',LogonError:'',ResultStatus:'Failed'},users,tenant).status.errorCode,null);
  assert.equal(normalizeAudit({...row,Operation:'UserLoggedIn',LogonError:'',ResultStatus:'Success'},users,tenant).status.errorCode,0);
  assert.throws(()=>normalizeAudit({...row,OrganizationId:client},users,tenant),/tenant/);
  assert.equal(normalizeAudit({...row,Operation:'Update user'},users,tenant),null);
  assert.equal(normalizeAudit({...row,UserId:'68d3fbcb-4fa9-4214-ac7f-b1ecb2825dd9||34539f57-3a73-4f90-86e1-03db447f13ec'},users,tenant),null);
  assert.equal(normalizeAudit({...row,UserId:'3dff3ca2-f735-4fa9-bfea-2170c90497fc'},users,tenant),null);
});
test('audit collector follows pagination, deduplicates blobs and skips completed blobs next time',async()=>{
  let reads=0;const windows=[];
  const api=new Audit(connection,{fetcher:async(url,opts)=>{
    if(url.includes('/token')){assert.equal(opts.body.get('scope'),'https://manage.office.com/.default');return Response.json({access_token:'fake'});}
    if(url.includes('subscriptions/list'))return Response.json([{contentType:'Audit.AzureActiveDirectory',status:'enabled'}]);
    if(url.includes('subscriptions/content')){const u=new URL(url);windows.push(u);return Response.json([{contentId:'b1',contentUri:base+'audit/b1'}],{headers:{NextPageUri:base+'next?page='+windows.length}});}
    if(url.includes('/next?'))return Response.json([{contentId:'b1',contentUri:base+'audit/b1'}]);
    if(url.endsWith('/audit/b1')){reads++;return Response.json([row,row]);}
    throw Error('Unexpected URL');
  }});
  const result=await api.collect({initialDays:7});assert.equal(reads,1);assert.equal(result.events.length,1);assert.equal(windows.length,7);
  assert.ok(windows.every(u=>Date.parse(u.searchParams.get('endTime'))-Date.parse(u.searchParams.get('startTime'))<=86400000));
  const next=await api.collect({previous:result.state});assert.equal(reads,1);assert.equal(next.events.length,0);
  assert.throws(()=>api.safeUrl('https://evil.test/'),/güvenilir/);assert.throws(()=>api.safeUrl(base.replace(tenant,client)),/tenant/);
});
test('new audit subscription waits without claiming a complete historical sync',async()=>{
  const api=new Audit(connection,{fetcher:async(url,opts)=>{
    if(url.includes('/token'))return Response.json({access_token:'fake'});
    if(url.includes('/list'))return Response.json([]);
    assert.equal(opts.method,'POST');return Response.json({status:'enabled'});
  }});
  const result=await api.collect();assert.equal(result.waiting,true);assert.equal(result.state.until,undefined);assert.deepEqual(result.events,[]);
});
test('retry honors throttling and redacts forbidden response secrets',async()=>{
  let calls=0;const sleeps=[];
  const api=new Audit(connection,{sleep:async n=>sleeps.push(n),fetcher:async url=>{
    if(url.includes('/token'))return Response.json({access_token:'fake'});
    if(calls++===0)return new Response('',{status:429,headers:{'Retry-After':'2'}});
    return Response.json({message:'must-not-leak-secret'}, {status:403});
  }});
  await assert.rejects(api.collect(),e=>/ActivityFeed.Read/.test(e.message)&&!e.message.includes('must-not-leak-secret'));assert.deepEqual(sleeps,[2000]);
});
test('M365 mode uses separate credentials, publishes atomically, hides cursors/secrets and omits premium calls',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ir-audit-')),origin='http://localhost:4334';let failBlob=false;
  const app=createApp({dataDir:dir,origin,scheduled:false,fetcher:async(url,opts)=>{
    if(url.includes('/token')){if(opts.body.get('scope').includes('manage.office'))assert.equal(opts.body.get('client_id'),tenant);return Response.json({access_token:'fake'});}
    if(url.includes('/$batch'))return new Response('{}',{status:403});
    if(url.includes('/users?'))return Response.json({value:[{id:'u',userPrincipalName:'user@example.test'}]});
    if(url.includes('/subscriptions/list'))return Response.json([{contentType:'Audit.AzureActiveDirectory',status:'enabled'}]);
    if(url.includes('/subscriptions/content'))return Response.json([{contentId:failBlob?'b2':'b1',contentUri:base+'audit/file'}]);
    if(url.endsWith('audit/file'))return failBlob?new Response('',{status:403}):Response.json([row]);
    throw Error('Premium endpoint must never be called');
  }});
  await new Promise(r=>app.server.listen(4334,'127.0.0.1',r));let cookie='',csrf='';
  const req=(path,b,headers={})=>fetch(origin+path,{method:b===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,...headers},body:b===undefined?undefined:JSON.stringify(b)});
  try{
    assert.equal((await req('/api/audit-connection',{})).status,401);
    const setup=await req('/api/setup',{password:'audit test password'});cookie=setup.headers.get('set-cookie').split(';')[0];csrf=(await setup.json()).csrf;
    await req('/api/connection',connection);await req('/api/mode',{mode:'m365'});
    assert.equal((await req('/api/audit-connection',{clientId:tenant,secret:'audit-secret'},{'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await req('/api/audit-connection',{clientId:tenant,secret:'audit-secret'})).status,200);
    await app.sync();assert.equal(app.store.events('2000').length,1);const cursor=app.store.get('sync').auditCursor;
    const status=await(await req('/api/status')).json();assert.equal(status.auditConnection.clientId,tenant);assert.equal(status.sync.auditCursor,undefined);assert.ok(!JSON.stringify(status).includes('audit-secret'));
    const dashboard=await(await req('/api/dashboard')).json();assert.equal(dashboard.metrics.events,1);assert.equal(dashboard.users[0].mfa,null);
    const consent=await(await req('/api/consent',{resource:'m365'})).json();assert.equal(new URL(consent.url).searchParams.get('scope'),'https://manage.office.com/.default');
    failBlob=true;await app.sync();assert.deepEqual(app.store.get('sync').auditCursor,cursor);assert.equal(app.store.events('2000').length,1);assert.match(app.store.get('sync').error,/ActivityFeed.Read/);
    await req('/api/disconnect',{});assert.equal(app.store.get('auditConnection'),null);
  }finally{await new Promise(r=>app.server.close(r));rmSync(dir,{recursive:true,force:true});}
});
