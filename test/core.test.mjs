import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
import {Store} from '../src/store.mjs';
import {analyze} from '../src/analysis.mjs';
import {Graph,safeGraphUrl} from '../src/graph.mjs';
import {createApp} from '../server.mjs';
import {parseSafeIps,safeIpMatcher,normalizeIp} from '../src/network.mjs';
import {applicationName} from '../src/catalog.mjs';
import {GeoResolver} from '../src/geo.mjs';

const event=(id,user,time,code=50126,ip='192.0.2.1')=>({id,userId:user,userDisplayName:user,createdDateTime:time,ipAddress:ip,status:{errorCode:code},location:{countryOrRegion:'TR'},appDisplayName:'Test'});
test('spray detection crosses fixed time bucket boundaries; MFA unknown is preserved',()=>{
  const events=Array.from({length:5},(_,i)=>event('e'+i,'u'+i,`2026-09-23T10:${String(8+i).padStart(2,'0')}:00Z`));
  const users=Array.from({length:5},(_,i)=>({id:'u'+i,displayName:'User '+i}));
  const result=analyze(users,[{id:'u0',isMfaRegistered:false}],events);
  assert.equal(result.incidents.length,1);assert.equal(result.incidents[0].users.length,5);
  assert.equal(result.users.find(u=>u.id==='u0').score,60);
  assert.equal(result.users.find(u=>u.id==='u1').mfa,null);
  assert.equal(result.users.find(u=>u.id==='u1').score,45);
});
test('CA/MFA failures and one-account brute force do not become spray incidents',()=>{
  const rows=Array.from({length:8},(_,i)=>event('e'+i,'u'+i,'2026-09-23T10:00:00Z',50076));
  assert.equal(analyze([],[],rows).incidents.length,0);
  const one=rows.map(e=>({...e,userId:'one',status:{errorCode:50126}}));
  assert.equal(analyze([],[],one).incidents.length,0);
});
test('suspicious success requires same IP and one-hour ordering',()=>{
  const rows=Array.from({length:5},(_,i)=>event('e'+i,'u'+i,'2026-09-23T10:00:00Z'));
  const result=analyze([],[],[...rows,event('ok','u0','2026-09-23T10:05:00Z',0)]);
  assert.equal(result.users.find(u=>u.id==='u0').score,100);assert.equal(result.users.find(u=>u.id==='u0').reviewState,'critical');
  const earlier=analyze([],[],[...rows,event('ok','u0','2026-09-23T09:59:00Z',0)]);
  assert.equal(earlier.users.find(u=>u.id==='u0').score,45);
});
test('MFA lowers unconfirmed attacks to Control but never lowers a suspicious success',()=>{
  const rows=Array.from({length:6},(_,i)=>event('m'+i,'target',`2026-09-23T10:0${i}:00Z`,50126,`198.51.100.${i+1}`));
  const directory=[{id:'target',displayName:'Target'}],mfa=[{id:'target',isMfaRegistered:true}];
  const controlled=analyze(directory,mfa,rows).users[0];assert.equal(controlled.reviewState,'control');assert.equal(controlled.score,49);
  const compromised=analyze(directory,mfa,[...rows,event('success','target','2026-09-23T10:07:00Z',0,'198.51.100.1')]).users[0];
  assert.equal(compromised.reviewState,'critical');assert.equal(compromised.score,100);
});
test('safe IP and CIDR entries are validated and excluded from attack scoring',()=>{
  assert.deepEqual(parseSafeIps('10.0.0.1\n192.168.60.0/24'),['10.0.0.1','192.168.60.0/24']);assert.throws(()=>parseSafeIps('999.1.1.1'));
  // Verify error messages are user-readable Turkish strings
  assert.throws(()=>parseSafeIps('abc'),{message:/Geçersiz güvenli IP veya CIDR: abc/});
  assert.throws(()=>parseSafeIps('192.168.1.1/abc'),{message:/Geçersiz güvenli IP ağı: 192\.168\.1\.1\/abc/});
  assert.throws(()=>parseSafeIps('10.0.0.1/33'),{message:/Geçersiz güvenli IP ağı/});
  // Empty lines and whitespace are tolerated
  assert.deepEqual(parseSafeIps('10.0.0.1\n  \n\n192.168.1.1'),['10.0.0.1','192.168.1.1']);
  assert.deepEqual(parseSafeIps([]),[]); assert.deepEqual(parseSafeIps(''),[]);
  assert.equal(normalizeIp('203.0.113.5:443'),'203.0.113.5');assert.equal(safeIpMatcher(['192.168.60.0/24'])('192.168.60.44'),true);
  const rows=Array.from({length:5},(_,i)=>event('safe'+i,'u'+i,'2026-09-23T10:00:00Z',50126,'192.168.60.44'));
  const result=analyze([],[],rows,{safeIps:['192.168.60.0/24']});assert.equal(result.incidents.length,0);assert.ok(result.users.every(u=>u.score===0&&u.trustedFailures===1));
});
test('known Microsoft application IDs are rendered as application identities',()=>{
  assert.equal(applicationName('00000002-0000-0ff1-ce00-000000000000'),'Office 365 Exchange Online');assert.equal(applicationName('11111111-2222-3333-4444-555555555555'),'Uygulama kimliği · 11111111-2222-3333-4444-555555555555');assert.equal(applicationName('custom-app'),'custom-app');
});
test('GeoIP resolver validates, caches and never sends private IPs externally',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ir-geo-'));const store=new Store(dir);let calls=0;
  const geo=new GeoResolver(store,{sleep:async()=>{},fetcher:async()=>{calls++;return Response.json({success:true,country:'Türkiye',country_code:'TR',city:'İstanbul'});}});
  try{const first=await geo.lookup('203.0.113.8'),second=await geo.lookup('203.0.113.8'),local=await geo.lookup('192.168.1.4');assert.equal(first.countryOrRegion,'Türkiye');assert.equal(second.countryCode,'TR');assert.equal(local.countryOrRegion,'Özel ağ');assert.equal(calls,1);await assert.rejects(geo.lookup('not-an-ip'));
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('distributed lockout storm against one account is detected and ranked first',()=>{
  const rows=Array.from({length:8},(_,i)=>event('lock'+i,'target',`2026-09-23T10:${String(i).padStart(2,'0')}:00Z`,50053,`198.51.100.${i+1}`));
  rows.push(event('normal','other','2026-09-23T10:00:00Z',50126,'192.0.2.1'));
  const result=analyze([{id:'target',displayName:'Target'},{id:'other',displayName:'Other'}],[],rows);
  assert.equal(result.incidents.length,1);assert.equal(result.incidents[0].type,'account');assert.equal(result.incidents[0].ips.length,8);
  assert.equal(result.users[0].id,'target');assert.ok(result.users[0].score>=75);assert.equal(result.users[1].score,0);
});
test('encrypted secret round trips, rejects tampering, and event writes deduplicate',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ir-store-'));const s=new Store(dir);
  try{const encrypted=s.encrypt('not-a-real-secret');assert.equal(s.decrypt(encrypted),'not-a-real-secret');assert.ok(!encrypted.includes('not-a-real-secret'));
    const bad=Buffer.from(encrypted,'base64');bad[29]^=1;assert.throws(()=>s.decrypt(bad.toString('base64')));
    const e=event('same','u',new Date().toISOString());s.commitSync([],[],[e,e],{lastSuccess:'now'});assert.equal(s.events('2000').length,1);
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('Graph rejects pagination host injection and retries throttling',async()=>{
  assert.throws(()=>safeGraphUrl('https://attacker.example/token'));assert.throws(()=>safeGraphUrl('https://graph.microsoft.com@attacker.example/x'));
  let gets=0;const delays=[];
  const fetcher=async url=>{if(url.includes('oauth2'))return Response.json({access_token:'fake',expires_in:3600});gets++;if(gets===1)return new Response('{}',{status:429,headers:{'Retry-After':'1'}});if(gets===2)return Response.json({value:[{id:'a'}],'@odata.nextLink':'https://graph.microsoft.com/v1.0/users?$skiptoken=x'});return Response.json({value:[{id:'b'}]});};
  const g=new Graph({tenantId:'test',clientId:'test',secret:'test'},{fetcher,sleep:async ms=>delays.push(ms)});
  assert.deepEqual((await g.list('users')).map(x=>x.id),['a','b']);assert.deepEqual(delays,[1000]);
});
test('Graph reports forbidden access without leaking response credentials',async()=>{
  const g=new Graph({},{fetcher:async url=>url.includes('oauth2')?Response.json({access_token:'fake'}):new Response('sensitive',{status:403})});
  await assert.rejects(g.list('users'),e=>e.message.includes('erişimi reddedildi')&&!e.message.includes('sensitive'));
});
test('Graph batches authentication methods and distinguishes password-only from MFA',async()=>{
  const calls=[];const g=new Graph({tenantId:'t',clientId:'c',secret:'s'},{fetcher:async(url,options)=>{
    if(url.includes('oauth2'))return Response.json({access_token:'fake'});
    calls.push(JSON.parse(options.body));return Response.json({responses:[
      {id:'0',status:200,body:{value:[{'@odata.type':'#microsoft.graph.passwordAuthenticationMethod'}]}},
      {id:'1',status:200,body:{value:[{'@odata.type':'#microsoft.graph.passwordAuthenticationMethod'},{'@odata.type':'#microsoft.graph.microsoftAuthenticatorAuthenticationMethod'}]}}
    ]});
  }});
  const rows=await g.authenticationRegistrations([{id:'u1'},{id:'u2'}]);
  assert.equal(calls.length,1);assert.equal(calls[0].requests.length,2);assert.equal(rows[0].isMfaRegistered,false);assert.equal(rows[1].isMfaRegistered,true);
});
test('Graph retries only throttled MFA method entries',async()=>{
  let call=0;const waits=[];const g=new Graph({tenantId:'t',clientId:'c',secret:'s'},{sleep:async ms=>waits.push(ms),fetcher:async(url,options)=>{
    if(url.includes('oauth2'))return Response.json({access_token:'fake'});call++;const request=JSON.parse(options.body).requests;
    if(call===1)return Response.json({responses:[{id:request[0].id,status:200,body:{value:[]}},{id:request[1].id,status:429,headers:{'Retry-After':'2'}}]});
    assert.equal(request.length,1);return Response.json({responses:[{id:request[0].id,status:200,body:{value:[{'@odata.type':'#microsoft.graph.phoneAuthenticationMethod'}]}}]});
  }});
  const rows=await g.authenticationRegistrations([{id:'u1'},{id:'u2'}]);assert.equal(call,2);assert.deepEqual(waits,[2000]);assert.equal(rows.find(x=>x.id==='u2').isMfaRegistered,true);
});
test('HTTP setup, auth, CSRF, consent binding, atomic sync, data isolation and persistence',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ir-http-'));let failMfa=false;
  const tenant='11111111-1111-1111-1111-111111111111',client='22222222-2222-2222-2222-222222222222';
  const fetcher=async url=>{
    if(url.includes('oauth2'))return Response.json({access_token:'fake',expires_in:3600});
    if(url.includes('userRegistrationDetails'))return failMfa?new Response('{}',{status:403}):Response.json({value:[{id:'u1',isMfaRegistered:false}]});
    if(url.includes('auditLogs'))return Response.json({value:[event('e1','u1',new Date().toISOString())]});
    return Response.json({value:[{id:'u1',displayName:'Test User',userPrincipalName:'user@example.test'}]});
  };
  const origin='http://localhost:4329', app=createApp({dataDir:dir,origin,fetcher,scheduled:false});
  await new Promise(r=>app.server.listen(4329,'127.0.0.1',r));let cookie='',csrf='';
  const request=async(path,b,extra={})=>fetch(origin+path,{method:b===undefined?'GET':'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json','X-CSRF-Token':csrf,...extra},body:b===undefined?undefined:JSON.stringify(b),redirect:'manual'});
  try{
    assert.equal((await request('/api/dashboard')).status,401);
    assert.equal((await request('/api/setup',{password:'tiny'})).status,400);
    const first=await request('/api/setup',{password:'correct horse battery'});assert.equal(first.status,200);cookie=first.headers.get('set-cookie').split(';')[0];csrf=(await first.json()).csrf;
    const badIpRes=await request('/api/settings',{intervalMinutes:15,initialDays:7,safeIps:'bad-ip'});assert.equal(badIpRes.status,400);const badIpBody=await badIpRes.json();assert.match(badIpBody.error,/Geçersiz güvenli IP/);
    assert.equal((await request('/api/settings',{intervalMinutes:15,initialDays:7,safeIps:'10.0.0.0/8'})).status,200);assert.deepEqual(app.store.get('config').safeIps,['10.0.0.0/8']);
    assert.equal((await request('/api/setup',{password:'another good password'})).status,409);
    assert.equal((await request('/api/connection',{},{Origin:'https://evil.example'})).status,403);
    assert.equal((await request('/api/connection',{}, {'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await request('/api/connection',{tenantId:tenant,clientId:client,secret:'test-secret'})).status,200);
    const status=await (await request('/api/status')).json();assert.ok(!JSON.stringify(status).includes('test-secret'));
    const consent=await(await request('/api/consent',{})).json(),url=new URL(consent.url);
    assert.equal(url.origin,'https://login.microsoftonline.com');assert.equal(url.searchParams.get('redirect_uri'),origin+'/auth/callback');
    assert.equal((await request('/auth/callback?state=bad&tenant='+tenant+'&admin_consent=True')).status,400);
    await app.sync();const dashboard=await(await request('/api/dashboard')).json();assert.equal(dashboard.metrics.users,1);assert.equal(dashboard.metrics.events,1);assert.equal(dashboard.users[0].mfa,false);
    failMfa=true;await app.sync();const stale=await(await request('/api/dashboard')).json();assert.equal(stale.metrics.events,1);assert.ok(stale.sync.error);assert.equal(stale.sync.lastSuccess,dashboard.sync.lastSuccess);
    assert.equal((await request('/api/connection',{tenantId:client,clientId:client,secret:'other'})).status,409);
    assert.equal((await request('/../src/store.mjs')).status,404);
    assert.equal((await request('/api/logout',{})).status,200);assert.equal((await request('/api/dashboard')).status,401);
    assert.equal((await request('/api/login',{password:'bad'})).status,401);
    assert.equal((await request('/api/login',{password:'correct horse battery'})).status,200);
    assert.ok(!readFileSync(join(dir,'IDSignal.db')).includes(Buffer.from('test-secret')));
  }finally{await new Promise(r=>app.server.close(r));const persisted=new Store(dir);assert.equal(persisted.get('users').length,1);persisted.close();rmSync(dir,{recursive:true,force:true});}
});
test('single-port viewer session can read dashboards while admin session unlocks settings',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ir-role-')),origin='http://localhost:4340',lan='http://192.168.60.178:4340';
  const app=createApp({dataDir:dir,origin,allowedOrigins:[lan],scheduled:false});await new Promise(r=>app.server.listen(4340,'127.0.0.1',r));
  const call=(path,body,cookie='',csrf='',requestOrigin=origin)=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:requestOrigin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
  try{
    let response=await call('/api/setup',{password:'admin password test'}),cookie=response.headers.get('set-cookie').split(';')[0],state=await response.json();
    const salt='b'.repeat(64);app.store.set('viewer',{salt,hash:scryptSync('viewer password test',salt,64).toString('hex')});
    await call('/api/logout',{},cookie,state.csrf);response=await call('/api/login',{password:'viewer password test',role:'viewer'},'','',lan);cookie=response.headers.get('set-cookie').split(';')[0];state=await response.json();
    assert.equal(state.readOnly,true);assert.equal((await call('/api/dashboard',undefined,cookie)).status,200);assert.equal((await call('/api/settings',{},cookie,state.csrf,lan)).status,403);
    await call('/api/logout',{},cookie,state.csrf,lan);response=await call('/api/login',{password:'admin password test',role:'admin'});state=await response.json();
    assert.equal(state.readOnly,false);assert.equal(state.loginRole,'admin');
  }finally{await new Promise(r=>app.server.close(r));rmSync(dir,{recursive:true,force:true});}
});

test('analyze excludes workload identities and service principals without email', () => {
  const directory = [{ id: 'user-1', displayName: 'Ali Veli', userPrincipalName: 'aliveli@example.com' }];
  const mfa = [{ id: 'user-1', isMfaRegistered: true }];
  const events = [
    { id: 'e1', userId: 'user-1', userPrincipalName: 'aliveli@example.com', createdDateTime: new Date().toISOString(), status: { errorCode: 0 } },
    { id: 'e2', userId: '68d3fbcb-4fa9-4214-ac7f-b1ecb2825dd9||34539f57-3a73-4f90-86e1-03db447f13ec', userPrincipalName: '68d3fbcb-4fa9-4214-ac7f-b1ecb2825dd9||34539f57-3a73-4f90-86e1-03db447f13ec', createdDateTime: new Date().toISOString(), status: { errorCode: 50126 } },
    { id: 'e3', userId: '3dff3ca2-f735-4fa9-bfea-2170c90497fc', userPrincipalName: '3dff3ca2-f735-4fa9-bfea-2170c90497fc', createdDateTime: new Date().toISOString(), status: { errorCode: 50126 } }
  ];
  const res = analyze(directory, mfa, events);
  assert.equal(res.users.length, 1);
  assert.equal(res.users[0].id, 'user-1');
  assert.equal(res.metrics.users, 1);
});
