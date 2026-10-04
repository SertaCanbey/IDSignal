import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {parseSignInImport} from '../src/import.mjs';
const row=(i=0)=>({id:'e'+i,userId:'u'+i,createdDateTime:new Date(Date.now()-60000).toISOString(),status:{errorCode:50126},ipAddress:'192.0.2.20',userDisplayName:'Test '+i});
test('portal import accepts full records, deduplicates and excludes expired records',()=>{
  const old={...row(2),createdDateTime:new Date(Date.now()-31*86400000).toISOString()};
  const result=parseSignInImport({value:[row(),row(),old]});
  assert.equal(result.events.length,1);assert.equal(result.expired,1);assert.equal(result.duplicates,1);assert.equal(result.events[0]._source,'portal-import');
});
test('malformed rows, missing status, oversized lists and future timestamps are rejected',()=>{
  assert.throws(()=>parseSignInImport({records:[row()]}));
  assert.throws(()=>parseSignInImport([row(),{...row(1),status:{}}]));
  assert.throws(()=>parseSignInImport([{...row(),status:{errorCode:'50126'}}]));
  assert.throws(()=>parseSignInImport([{...row(),createdDateTime:new Date(Date.now()+86400000).toISOString()}]));
  assert.throws(()=>parseSignInImport(new Array(100001).fill(row())));
});
test('free mode only calls users, import is authenticated and tenant-bound, MFA stays unknown',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ir-free-')),origin='http://localhost:4331';
  const tenant='11111111-1111-1111-1111-111111111111',client='22222222-2222-2222-2222-222222222222';
  const urls=[];
  const app=createApp({dataDir:dir,origin,scheduled:false,fetcher:async url=>{urls.push(url);if(url.includes('oauth2'))return Response.json({access_token:'fake'});if(url.includes('/users?'))return Response.json({value:[{id:'u0',displayName:'Test User'}]});throw Error('Premium endpoint must never be called');}});
  await new Promise(r=>app.server.listen(4331,'127.0.0.1',r));let cookie='',csrf='';
  const req=(path,b,headers={})=>fetch(origin+path,{method:b===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,...headers},body:b===undefined?undefined:JSON.stringify(b)});
  try{
    assert.equal((await req('/api/import-signins',{})).status,401);
    const setup=await req('/api/setup',{password:'offline free mode test'});cookie=setup.headers.get('set-cookie').split(';')[0];csrf=(await setup.json()).csrf;
    assert.equal((await req('/api/mode',{mode:'free'})).status,200);
    const {script}=await(await req('/api/bootstrap-script',{tenantId:tenant})).json();assert.ok(!script.includes("'AuditLog.Read.All'"));
    await req('/api/connection',{tenantId:tenant,clientId:client,secret:'fake-test-secret'});
    // Even older premium MFA snapshots must not be used in free mode.
    app.store.set('mfa',[{id:'u0',isMfaRegistered:false}]);
    const before=await(await req('/api/dashboard')).json();assert.equal(before.mode,'free');
    await app.sync();assert.equal(urls.filter(u=>!u.includes('oauth2')).length,1);
    assert.ok(app.store.get('sync').lastDirectorySuccess);assert.equal(app.store.get('sync').lastSuccess,undefined);
    const payload={tenantId:tenant,confirmTenant:true,document:Array.from({length:5},(_,i)=>row(i))};
    assert.equal((await req('/api/import-signins',payload,{'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await req('/api/import-signins',{...payload,tenantId:client})).status,400);
    assert.equal((await req('/api/import-signins',{...payload,confirmTenant:false})).status,400);
    const first=await(await req('/api/import-signins',payload)).json();assert.equal(first.inserted,5);
    const again=await(await req('/api/import-signins',payload)).json();assert.equal(again.inserted,0);assert.equal(again.existing,5);
    const bad=await req('/api/import-signins',{...payload,document:[row(99),{}]});assert.equal(bad.status,400);
    app.store.set('mfa',[{id:'u0',isMfaRegistered:false}]);
    const dashboard=await(await req('/api/dashboard')).json();assert.equal(dashboard.metrics.events,5);assert.equal(dashboard.metrics.incidents,1);assert.equal(dashboard.metrics.mfaMissing,0);assert.equal(dashboard.metrics.mfaUnknown,5);assert.equal(dashboard.users[0].score,45);
    // M365 Audit mode uses Graph authentication methods even though its
    // sign-in events come from the Office 365 Management Activity API.
    assert.equal((await req('/api/mode',{mode:'m365'})).status,200);
    const auditDashboard=await(await req('/api/dashboard')).json();
    assert.equal(auditDashboard.metrics.mfaMissing,1);assert.equal(auditDashboard.metrics.mfaUnknown,0);
    assert.equal((await req('/api/mode',{mode:'free'})).status,200);
    await req('/api/settings',{intervalMinutes:30,initialDays:1});assert.equal(app.store.get('config').mode,'free');
    await app.sync();assert.equal(app.store.events('2000').length,5);
  }finally{await new Promise(r=>app.server.close(r));rmSync(dir,{recursive:true,force:true});}
});
