import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

test('bootstrap token is tenant-bound, single use; consent state is single use and access is verified',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ir-provision-')),origin='http://localhost:4330';
  const tenant='11111111-1111-1111-1111-111111111111',client='22222222-2222-2222-2222-222222222222';
  const app=createApp({dataDir:dir,origin,scheduled:false,fetcher:async url=>url.includes('oauth2')?Response.json({access_token:'fake'}):Response.json({value:[]})});
  await new Promise(r=>app.server.listen(4330,'127.0.0.1',r));
  let cookie='',csrf='';
  const req=(path,b,headers={})=>fetch(origin+path,{method:b===undefined?'GET':'POST',redirect:'manual',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,...headers},body:b===undefined?undefined:JSON.stringify(b)});
  try{
    const setup=await req('/api/setup',{password:'offline test password'});cookie=setup.headers.get('set-cookie').split(';')[0];csrf=(await setup.json()).csrf;
    const {script}=await(await req('/api/bootstrap-script',{tenantId:tenant})).json();
    assert.ok(script.includes("'AuditLog.Read.All', 'User.Read.All'"));assert.ok(!script.includes('__TOKEN__'));
    const token=/\$bootstrapToken = '([a-f0-9]+)'/.exec(script)[1];
    const payload={tenantId:tenant,clientId:client,secret:'fake-bootstrap-secret'};
    assert.equal((await req('/api/bootstrap-import',{...payload,tenantId:client},{Authorization:'Bearer '+token})).status,400);
    assert.equal((await req('/api/bootstrap-import',payload,{Authorization:'Bearer '+token})).status,200);
    assert.equal((await req('/api/bootstrap-import',payload,{Authorization:'Bearer '+token})).status,403);
    assert.equal((await req('/api/bootstrap-script',{tenantId:tenant})).status,409);
    const {url}=await(await req('/api/consent',{})).json();
    const state=new URL(url).searchParams.get('state');
    const callback='/auth/callback?'+new URLSearchParams({state,tenant,admin_consent:'True'});
    assert.equal((await req(callback)).status,303);assert.equal((await req(callback)).status,400);
    // Wait only for this mocked asynchronous sync to settle, bounded at one second.
    for(let i=0;i<50;i++){if(app.store.get('sync')?.lastSuccess)break;await new Promise(r=>setTimeout(r,20));}
    assert.equal(app.store.get('connection').verified,true);
    assert.equal((await req('/api/disconnect',{})).status,200);assert.equal(app.store.get('connection'),null);
  }finally{await new Promise(r=>app.server.close(r));rmSync(dir,{recursive:true,force:true});}
});
