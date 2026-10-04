import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {EdgePortalDriver,readDownload} from '../src/portal.mjs';

// Real browser DOM regression tests; routes are fulfilled locally, no tenant calls.
let playwright;
try{playwright=createRequire(import.meta.url)('playwright-core');}
catch{playwright=createRequire(process.execPath)('playwright-core');}
const {chromium}=playwright;

// Skip all tests gracefully when Chrome is not installed on this machine.
let chromeAvailable=true;
try{const b=await chromium.launch({channel:'chrome',headless:true});await b.close();}
catch{chromeAvailable=false;}
const pageHtml=`<!doctype html><h1>Sign-in events</h1>
<button onclick="throw Error('Table sort must not be clicked')">Date</button>
<button id="range" onclick="setTimeout(()=>document.querySelector('#options').hidden=false,200)">Date range: Last 24 hours</button>
<div id="options" hidden><button role="menuitemradio" onclick="document.querySelector('#apply').hidden=false">Last 7 days</button>
<button id="apply" hidden onclick="document.querySelector('#range').textContent='Date range: Last 7 days';document.querySelector('#options').hidden=true">Apply</button></div>
<button role="menuitem" id="export" onclick="setTimeout(()=>document.querySelector('#json').hidden=false,100)">Download</button>
<button id="json" role="menuitem" hidden onclick="setTimeout(()=>document.querySelector('aside').hidden=false,200)">Download JSON</button>
<aside aria-label="Download Sign-ins in JSON format" hidden>
<h2>Download Sign-ins in JSON format</h2>
<label>File Name<input value="NonInteractiveSignIns_2026-09-23"></label><div><button onclick="throw Error('Wrong file')">Download</button></div>
<label>File Name<input value="InteractiveSignIns_2026-09-23"></label><div><button id="correct" onclick="document.querySelector('#file').click()">Download</button></div>
<section><label>File Name<input value="ApplicationSignIns_2026-09-23"></label><div><button disabled>Download</button></div></section>
<section><label>File Name<input value="MSISignIns_2026-09-23"></label><div><button onclick="throw Error('Wrong file')">Download</button></div></section>
</aside><a id="file" download="InteractiveSignIns.json" href="data:application/json,%5B%7B%22id%22%3A%22test-event%22%7D%5D" hidden>file</a>`;

test('real DOM: date filter excludes Date column; JSON export selects the matching file row',{skip:!chromeAvailable&&'Chrome kurulu değil'},async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext({acceptDownloads:true});
    await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:pageHtml}));
    const page=await context.newPage();await page.goto('https://entra.microsoft.com/');
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const driver=new EdgePortalDriver();Object.assign(driver,{browser,context,page});
    await driver.navigate();await driver.selectSevenDays();
    assert.equal(await page.locator('#range').innerText(),'Date range: Last 7 days');
    assert.deepEqual(await readDownload(await driver.download()),[{id:'test-event'}]);
    // Retry with an already-open blade: must not click a random global Download.
    assert.deepEqual(await readDownload(await driver.download()),[{id:'test-event'}]);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});

test('real DOM: multiple interactive file rows are rejected without an arbitrary download',{skip:!chromeAvailable&&'Chrome kurulu değil'},async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext();
    await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:pageHtml.replace('NonInteractiveSignIns_','InteractiveSignIns_').replace('format" hidden','format"')}));
    const page=await context.newPage();await page.goto('https://entra.microsoft.com/');
    const driver=new EdgePortalDriver();Object.assign(driver,{browser,context,page});
    await assert.rejects(driver.submitJsonExport(),/tekil olarak bulunamadı/);
  }finally{await browser.close();}
});

test('M365 source UI exposes one API connection button without manual credential fields',{skip:!chromeAvailable&&'Chrome kurulu değil'},async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();const errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));
    const state={initialized:true,authenticated:true,csrf:'test',connection:{tenantId:'11111111-1111-1111-1111-111111111111',clientId:'22222222-2222-2222-2222-222222222222',directoryVerified:true},config:{mode:'m365',initialDays:7,intervalMinutes:15},sync:{mode:'m365'},portal:{},redirectUri:'http://localhost:4335/auth/callback'};
    await page.route('**/*',async route=>{
      const u=new URL(route.request().url());
      if(u.pathname.startsWith('/api/')){
        if(route.request().method()==='POST'){const b=route.request().postDataJSON();posts.push([u.pathname,b]);if(u.pathname==='/api/audit-connection')state.auditConnection={clientId:b.clientId};if(u.pathname==='/api/settings')return route.fulfill({json:{ok:true,safeIpCount:1}});return route.fulfill({json:{ok:true}});}
        return route.fulfill({json:u.pathname==='/api/status'?state:{metrics:{},users:[],incidents:[]}});
      }
      const name=u.pathname==='/'?'index.html':u.pathname.slice(1);
      return route.fulfill({body:readFileSync(new URL('../public/'+name,import.meta.url)),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
    });
    await page.goto('http://localhost:4335/#sources');
    await page.getByRole('heading',{name:'Microsoft 365 Audit API',exact:true}).waitFor();
    assert.equal(await page.locator('details.mode-guide').count(),3);
    assert.equal(await page.locator('details.mode-guide[open]').count(),1);
    assert.match(await page.locator('details.mode-guide[open]').innerText(),/UserAuthenticationMethod\.Read\.All/);
    assert.equal(await page.locator('#portal-start').count(),0);assert.equal(await page.locator('#import-form').count(),0);
    assert.equal(await page.locator('#audit-secret').count(),0);
    assert.equal(await page.locator('#content button').filter({hasText:'API izinlerini bağla / güncelle'}).count(),1);
    await page.locator('#connect-api').click();
    assert.ok(posts.some(([p])=>p==='/api/connect-api'));
    await page.goto('http://localhost:4335/#settings');await page.locator('#safe-ips').waitFor();
    await page.locator('#safe-ips').fill('192.168.60.0/24');await page.getByRole('button',{name:'Ayarları kaydet'}).click();
    await page.waitForFunction(()=>document.querySelector('#notice')?.textContent.includes('güvenli IP'));
    assert.ok(posts.some(([p,b])=>p==='/api/settings'&&b.safeIps==='192.168.60.0/24'));
    assert.ok(!posts.some(([p])=>p.includes('/portal/')));assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});

test('shared dashboard shows five tabs and blocks hidden routes in the UI',{skip:!chromeAvailable&&'Chrome kurulu değil'},async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let logged=false;const state={initialized:true,authenticated:true,readOnly:true,csrf:'test',connection:{directoryVerified:true},config:{mode:'m365'},sync:{auditWaiting:true}};
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.startsWith('/api/')){
    if(u.pathname==='/api/login'){logged=true;return route.fulfill({json:state});}
    return route.fulfill({json:u.pathname==='/api/status'?(logged?state:{initialized:true,shared:true,authenticated:false,readOnly:false}):{metrics:{},users:[],incidents:[]}});
   }
   const name=u.pathname==='/'?'index.html':u.pathname.slice(1);
   return route.fulfill({body:readFileSync(new URL('../public/'+name,import.meta.url)),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://localhost:4335/');await page.getByRole('heading',{name:'Ekip paneline giriş'}).waitFor();
  await page.locator('#password').fill('synthetic');await page.getByRole('button',{name:'Oturum aç →'}).click();
  await page.locator('.sidebar nav').waitFor();assert.equal(await page.locator('.sidebar nav a').count(),5);
  assert.equal(await page.locator('a[href="#sources"],a[href="#settings"],#sync').count(),0);
  await page.evaluate(()=>{location.hash='settings';});await page.getByRole('heading',{name:'Genel Bakış',exact:true}).waitFor();
  assert.equal(await page.locator('#settings-form').count(),0);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
