import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {scryptSync} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.mjs';
import {createShareServer} from '../share-server.mjs';
const salt='a'.repeat(64),password='synthetic-share-password',credential={salt,hash:scryptSync(password,salt,64).toString('hex')};
test('LAN viewer requires login, returns dashboard only, forbids writes, hides connection secrets and invalidates logout',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ir-share-')),store=new Store(dir);
 store.set('connection',{secret:'private-secret',tenantId:'private-tenant',clientId:'private-client'});
 store.set('users',[{id:'u',displayName:'Test User',userPrincipalName:'user@example.test'}]);
 store.set('config',{mode:'m365'});store.set('sync',{auditWaiting:true,error:null});store.close();
 const server=createShareServer({dataDir:dir,host:'127.0.0.1',port:4338,credential});await new Promise(r=>server.listen(4338,'127.0.0.1',r));
 const origin='http://127.0.0.1:4338';let cookie='',csrf='';
 const request=(path,body,headers={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf,...headers},body:body===undefined?undefined:JSON.stringify(body)});
 try{
  assert.equal((await request('/api/dashboard')).status,401);
  assert.deepEqual(await(await request('/api/status')).json(),{initialized:true,authenticated:false,readOnly:true});
  assert.equal((await request('/api/login',{password},{Origin:'http://evil.test'})).status,403);
  assert.equal((await request('/api/login',{password:'wrong'})).status,401);
  const login=await request('/api/login',{password});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];const state=await login.json();csrf=state.csrf;assert.equal(state.readOnly,true);assert.ok(!JSON.stringify(state).includes('private-'));
  const data=await(await request('/api/dashboard')).json();assert.equal(data.users.length,1);assert.equal(data.users[0].email,'user@example.test');
  assert.equal((await request('/api/dashboard?days=999')).status,400);
  for(const path of ['/api/connection','/api/settings','/api/sync','/api/connect-api','/api/disconnect','/api/setup'])assert.equal((await request(path,{})).status,403);
  assert.equal((await request('/api/summary')).status,404);
  const badHost=await new Promise((resolve,reject)=>http.get(origin,{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject));assert.equal(badHost,403);
  assert.equal((await request('/api/logout',{}, {'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await request('/api/logout',{})).status,200);assert.equal((await request('/api/dashboard')).status,401);
  for(let i=0;i<5;i++)assert.equal((await request('/api/login',{password:'wrong'})).status,401);
  assert.equal((await request('/api/login',{password})).status,429);
 }finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});
