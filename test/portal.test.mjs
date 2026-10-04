import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PortalAutomation,readDownload,EdgePortalDriver} from '../src/portal.mjs';
import {createApp} from '../server.mjs';
const tenant='11111111-1111-1111-1111-111111111111';
const record=(i=0,days=0)=>({id:'portal-'+i,userId:'u'+i,createdDateTime:new Date(Date.now()-days*86400000).toISOString(),status:{errorCode:50126},ipAddress:'192.0.2.5'});
const download=(data,name='InteractiveSignIns.json')=>({suggestedFilename:()=>name,failure:async()=>null,createReadStream:async()=>Readable.from([Buffer.from(JSON.stringify(data))])});
const fakePage=(url,closed=false)=>({url:()=>url,isClosed:()=>closed,setDefaultTimeout:()=>{}});

test('late portal download is retained after a timeout and consumed on retry',async()=>{
  const driver=new EdgePortalDriver();driver.page=new EventEmitter();
  const keepAlive=setTimeout(()=>{},1000);
  try{
    await assert.rejects(driver.waitForPortalDownload(10),e=>e.status===409);
    const file=download([record()]);driver.page.emit('download',file);
    assert.equal(await driver.waitForPortalDownload(10),file);
    assert.equal(driver.capturedDownload,null);
  }finally{clearTimeout(keepAlive);}
});

test('retry waits for an in-progress export without clicking Download again',async()=>{
  const driver=new EdgePortalDriver();driver.page=new EventEmitter();driver.assertPortal=()=>{};driver.downloadRequested=true;
  driver.click=async()=>{throw Error('Export must not restart');};
  const pending=driver.download(),file=download([record()]);
  driver.page.emit('download',file);assert.equal(await pending,file);assert.equal(driver.downloadRequested,false);
});
test('modern Sign-in events heading and Date range: Last 7 days are recognized',async()=>{
  const driver=new EdgePortalDriver();driver.recoverPage=async()=>{};driver.assertPortal=()=>{};
  driver.find=async(pattern,roles)=>{
    if(roles.includes('heading')&&pattern.test('Sign-in events'))return {};
    if(roles.includes('button')&&pattern.test('Date range: Last 7 days'))return {};
    return null;
  };
  driver.click=async()=>{throw Error('Already open and filtered: no navigation or extra clicks expected');};
  await driver.navigate();await driver.selectSevenDays();
});
test('modern Sign-in events page still rejects an unverified seven-day filter',async()=>{
  const driver=new EdgePortalDriver();driver.assertPortal=()=>{};
  driver.find=async(pattern,roles)=>roles.includes('heading')&&pattern.test('Sign-in events')?{}:null;
  driver.click=async()=>false;
  await assert.rejects(driver.selectSevenDays(),/Tarih filtresi bulunamadı/);
});
test('closed login tab rebinds to the Entra tab in the same browser context',()=>{
  const driver=new EdgePortalDriver(),closed=fakePage('https://login.microsoftonline.com/',true),portal=fakePage('https://entra.microsoft.com/#home');
  driver.page=closed;driver.context={pages:()=>[closed,portal]};driver.assertPortal();assert.equal(driver.page,portal);
});
test('no portal tab recovers by opening Entra in the existing context',async()=>{
  const driver=new EdgePortalDriver();let opened=0;
  const portal={...fakePage('https://entra.microsoft.com/'),goto:async()=>{opened++;}};
  driver.browser={isConnected:()=>true};driver.anchor=fakePage('about:blank');
  let pages=[driver.anchor];driver.context={pages:()=>pages,newPage:async()=>{pages.push(portal);return portal;}};
  await driver.recoverPage();assert.equal(opened,1);assert.equal(driver.page,portal);
});
test('login navigation interruption does not close the live Edge context',async()=>{
  const pages=[];let closes=0,launchOptions;
  const context={on:()=>{},pages:()=>pages,close:async()=>{closes++;},newPage:async()=>{const p={...fakePage('https://login.microsoftonline.com/'),setContent:async()=>{},goto:async()=>{throw Error('navigation interrupted');}};pages.push(p);return p;}};
  const browser={isConnected:()=>true,newContext:async()=>context,close:async()=>{closes++;}};
  const driver=new EdgePortalDriver({channel:'chrome',chromium:{launch:async options=>{launchOptions=options;return browser;}}});
  await driver.open();assert.equal(launchOptions.channel,'chrome');assert.equal(closes,0);assert.equal(pages.length,2);assert.equal(driver.health().closed,false);assert.equal(driver.health().applicationRequestedClose,false);
  assert.ok(driver.health().events.some(e=>e.event==='initial_navigation_interrupted'));
});
test('browser diagnostics distinguish application-requested closure without storing URLs',async()=>{
  const driver=new EdgePortalDriver();driver.browser={isConnected:()=>false,close:async()=>{}};driver.context={close:async()=>{}};
  driver.record('browser_disconnected');assert.equal(driver.health().applicationRequestedClose,false);
  await driver.close('cancelled');const health=driver.health();assert.equal(health.applicationRequestedClose,true);assert.equal(health.events.at(-1).event,'application_close_cancelled');
  assert.ok(!JSON.stringify(health).includes('https:'));
});
test('disconnected browser releases active job so restart is available',async()=>{
  let disconnected=false;
  const driver={open:async()=>{},close:async()=>{},health:()=>({closed:disconnected})};
  const portal=new PortalAutomation({support:()=>({available:true}),driverFactory:()=>driver,importEvents:()=>{}});
  await portal.start(tenant);disconnected=true;assert.equal(portal.status().phase,'browser_closed');assert.equal(portal.active(),false);
});
function fixture(options={}){let closed=0;const calls=[];return {calls,get closed(){return closed;},open:async()=>{calls.push('open');},close:async()=>{closed++;},navigate:async()=>{calls.push('navigate');},selectSevenDays:async()=>{calls.push('seven');if(options.filterError)throw Object.assign(Error('Tarih doğrulanamadı'),{status:409});},download:async()=>{calls.push('download');return download(options.rows||[record()]);},listenDownload:async()=>{calls.push('listen');return download([record()]);}};}
test('portal flow confirms tenant, verifies date, imports once and closes browser',async()=>{
  const driver=fixture({rows:[record(),record(1,8)]});let committed;
  const portal=new PortalAutomation({support:()=>({available:true}),driverFactory:()=>driver,importEvents:(events,meta)=>{committed={events,meta};return {inserted:events.length,existing:0};}});
  await portal.start(tenant);assert.equal(portal.status().phase,'awaiting_login');
  await assert.rejects(portal.continue({tenantId:tenant,confirmed:false}));
  await assert.rejects(portal.continue({tenantId:'other',confirmed:true}));
  await portal.continue({tenantId:tenant,confirmed:true});
  assert.deepEqual(driver.calls,['open','navigate','seven','download']);assert.equal(committed.events.length,1);assert.equal(committed.meta.expired,1);assert.equal(portal.status().phase,'completed');assert.equal(driver.closed,1);assert.equal(portal.active(),false);
});
test('ambiguous date stops before downloading and retains actionable status',async()=>{
  const driver=fixture({filterError:true});let committed=false;
  const portal=new PortalAutomation({support:()=>({available:true}),driverFactory:()=>driver,importEvents:()=>{committed=true;}});
  await portal.start(tenant);await portal.continue({tenantId:tenant,confirmed:true});
  assert.equal(committed,false);assert.ok(!driver.calls.includes('download'));assert.equal(portal.status().phase,'needs_attention');await portal.cancel();assert.equal(driver.closed,1);
});
test('download capture rejects non-JSON and oversized files',async()=>{
  await assert.rejects(readDownload(download([], 'data.csv')));
  await assert.rejects(readDownload(download([record()]),10));
});
test('cancelling while Edge opens does not resurrect the session',async()=>{
  let release;const ready=new Promise(r=>{release=r;});
  const driver={...fixture(),open:()=>ready};
  const portal=new PortalAutomation({support:()=>({available:true}),driverFactory:()=>driver,importEvents:()=>{throw Error('must not import');}});
  const start=portal.start(tenant);await portal.cancel();release();await start;assert.equal(portal.status().phase,'cancelled');assert.equal(portal.active(),false);
});
test('portal endpoints require login/CSRF and lock connection changes while active',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ir-portal-')),origin='http://localhost:4332',driver=fixture();
  const app=createApp({dataDir:dir,origin,scheduled:false,portalOptions:{support:()=>({available:true}),driverFactory:()=>driver}});
  await new Promise(r=>app.server.listen(4332,'127.0.0.1',r));let cookie='',csrf='';
  const req=(path,b,headers={})=>fetch(origin+path,{method:b===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,...headers},body:b===undefined?undefined:JSON.stringify(b)});
  try{
    assert.equal((await req('/api/portal/start',{})).status,401);
    const setup=await req('/api/setup',{password:'offline portal testing'});cookie=setup.headers.get('set-cookie').split(';')[0];csrf=(await setup.json()).csrf;
    await req('/api/connection',{tenantId:tenant,clientId:tenant,secret:'offline'});await req('/api/mode',{mode:'free'});
    assert.equal((await req('/api/portal/start',{}, {'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await req('/api/portal/start',{})).status,202);
    assert.equal((await req('/api/disconnect',{})).status,409);assert.equal((await req('/api/sync',{})).status,409);
    assert.equal((await req('/api/portal/continue',{tenantId:tenant,confirmTenant:false})).status,400);
    assert.equal((await req('/api/portal/continue',{tenantId:tenant,confirmTenant:true})).status,202);
    for(let i=0;i<50&&app.portal.running;i++)await new Promise(r=>setTimeout(r,20));
    assert.equal(app.store.events('2000').length,1);assert.equal(app.portal.status().phase,'completed');
  }finally{await new Promise(r=>app.server.close(r));rmSync(dir,{recursive:true,force:true});}
});
