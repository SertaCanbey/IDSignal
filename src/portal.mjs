import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseSignInImport } from './import.mjs';

const portalOrigin='https://entra.microsoft.com';
const issue=(status,message)=>Object.assign(new Error(message),{status});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const labels={
  entra:/^(Entra ID|Microsoft Entra ID)$/i,
  monitoring:/^(Monitoring (&|and) health|İzleme (ve|&) sistem durumu|İzleme ve sağlık)$/i,
  signins:/^(Sign-in logs|Sign-in events|Sign-ins|Oturum açma günlükleri|Oturum açma olayları|Oturum açma kayıtları|Oturum açmalar)$/i,
  // A bare "Date" is the sortable table column, not the date-range filter.
  date:/^(Date(?: range)?|Tarih(?: aralığı)?)\s*:/i,
  seven:/^(Last 7 days|Past 7 days|Son 7 gün)$/i,
  appliedSeven:/(Date|Tarih).*?(Last 7 days|Past 7 days|Son 7 gün)/i,
  download:/^(Download|İndir|İndirme)$/i,
  json:/^(Download JSON|JSON|JSON indir|JSON olarak indir)$/i,
  apply:/^(Apply|Uygula)$/i,
};

export function browserSupport() {
  if(process.platform!=='win32')return {available:false,reason:'Portal otomasyonu masaüstü Windows ve Chrome veya Edge gerektirir. Docker içinde çalışmaz.'};
  const roots=[process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean);
  const chrome=roots.some(p=>existsSync(join(p,'Google','Chrome','Application','chrome.exe')));
  const edge=roots.some(p=>existsSync(join(p,'Microsoft','Edge','Application','msedge.exe')));
  const channel=process.env.PORTAL_BROWSER==='msedge'&&edge?'msedge':chrome?'chrome':edge?'msedge':null;
  if(!channel)return {available:false,reason:'Chrome veya Edge kurulu değil. Tarayıcı kurun veya JSON aktarımını kullanın.'};
  try{loadPlaywright();return {available:true,channel,browserLabel:channel==='chrome'?'Google Chrome':'Microsoft Edge'};}catch{return {available:false,reason:'Tarayıcı otomasyon paketi eksik. Proje klasöründe npm install çalıştırın.'};}
}
function loadPlaywright() {
  try{return createRequire(import.meta.url)('playwright-core');}
  catch{return createRequire(process.execPath)('playwright-core');}
}

// Only visible UI controls are used. No portal tokens, private APIs, or premium Graph calls.
export class EdgePortalDriver {
  constructor({chromium,channel}={}){this.chromium=chromium;this.channel=channel;this.events=[];this.closeRequested=false;}
  record(event){this.events.push({time:new Date().toISOString(),event});if(this.events.length>20)this.events.shift();}
  async open() {
    const chromium=this.chromium||loadPlaywright().chromium;
    this.channel=this.channel||browserSupport().channel;
    this.record('browser_launch_'+this.channel);
    this.browser=await chromium.launch({channel:this.channel,headless:false});
    this.browser.on?.('disconnected',()=>this.record('browser_disconnected'));
    this.context=await this.browser.newContext({acceptDownloads:true,locale:'en-US'});
    this.contextClosed=false;
    this.context.on('close',()=>{this.contextClosed=true;this.record('context_closed');});
    this.context.on('page',page=>{this.record('tab_opened');page.on('close',()=>this.record('tab_closed'));page.on('crash',()=>this.record('tab_crashed'));});
    // Keep the dedicated window alive when an authentication tab closes itself.
    // This page contains no credentials and never reads the user's other profiles.
    this.anchor=await this.context.newPage();
    await this.anchor.setContent('<!doctype html><html lang="tr"><meta charset="utf-8"><title>IDSignal · Otomasyon oturumu</title><body style="background:#0b1020;color:#edf2fb;font:18px Segoe UI;padding:60px"><h1>IDSignal otomasyon oturumu</h1><p>Bu sekmeyi açık bırakın. Yanındaki sekmede Microsoft girişini tamamlayın.</p><p>Giriş sekmesi kapanırsa IDSignal panelindeki “Giriş yaptım, devam et” düğmesi portalı aynı oturumda yeniden açar.</p><p>Normal tarayıcınızdaki veya Codex sekmesindeki oturum bu otomasyona bağlı değildir.</p></body></html>');
    this.page=await this.context.newPage();
    this.page.setDefaultTimeout(1200);
    try{await this.page.goto(portalOrigin,{waitUntil:'domcontentloaded',timeout:60000});}
    catch(e){this.record('initial_navigation_interrupted');if(this.health().closed)throw e;/* Login redirects may interrupt navigation; leave the window open. */}
  }
  async close(reason='cleanup'){this.closeRequested=true;this.record('application_close_'+reason);await this.context?.close().catch(()=>{});await this.browser?.close().catch(()=>{});}
  health(){return {closed:!this.browser?.isConnected()||this.contextClosed===true,applicationRequestedClose:this.closeRequested,events:[...this.events]};}
  resolvePage(){
    const pages=this.context?.pages().filter(p=>p!==this.anchor&&!p.isClosed())||[];
    const portals=pages.filter(p=>{try{return new URL(p.url()).origin===portalOrigin;}catch{return false;}});
    if(!this.page||this.page.isClosed()||!portals.includes(this.page))this.page=portals.at(-1)||pages.at(-1)||null;
    this.page?.setDefaultTimeout(1200);
    return this.page;
  }
  async recoverPage(){
    if(this.health().closed)throw issue(409,'Otomasyona ait otomasyon penceresi kapandı veya bağlantısı kesildi. Panelden “Portaldan son 7 günü al” ile yeni oturum başlatın.');
    if(this.resolvePage())return;
    this.page=await this.context.newPage();this.page.setDefaultTimeout(1200);
    try{await this.page.goto(portalOrigin,{waitUntil:'domcontentloaded',timeout:60000});}
    catch{if(this.health().closed)throw issue(409,'Tarayıcı bağlantısı kesildi. Yeni portal oturumu başlatın.');}
    this.resolvePage();
  }
  assertPortal(){
    this.resolvePage();
    if(!this.page||this.page.isClosed())throw issue(409,'Giriş sekmesi kapandı. “Giriş yaptım, devam et” ile portalı otomasyonun otomasyon penceresinde yeniden açın.');
    if(new URL(this.page.url()).origin!==portalOrigin)throw issue(409,'Microsoft girişini ve MFA’yı otomasyon penceresinde tamamlayın; Entra portalına döndükten sonra devam edin.');
  }
  async find(pattern,roles=['button','link','treeitem','tab','menuitem','option']) {
    this.assertPortal();
    for(const frame of this.page.frames()) {
      // Entra blades may render in portal-owned frames. Never inspect login/provider frames.
      if(frame!==this.page.mainFrame()&&!/^https:\/\/([a-z0-9-]+\.)*(entra\.microsoft\.com|azure\.com|azure\.net)\//i.test(frame.url()))continue;
      for(const role of roles) {
        const matches=frame.getByRole(role,{name:pattern});
        const visible=[];for(const locator of await matches.all())if(await locator.isVisible())visible.push(locator);
        if(visible.length===1)return visible[0];
        if(visible.length>1)throw issue(409,'Portalda aynı adlı birden fazla kontrol var. İlgili paneli kapatıp tekrar deneyin.');
      }
    }
    return null;
  }
  async click(pattern,roles){const item=await this.find(pattern,roles);if(!item)return false;await item.click();return true;}
  async waitForControl(pattern,roles,timeout=10000){const until=Date.now()+timeout;do{const item=await this.find(pattern,roles);if(item)return item;await new Promise(r=>setTimeout(r,400));}while(Date.now()<until);return null;}
  async navigate() {
    await this.recoverPage();
    this.assertPortal();
    if(await this.find(labels.signins,['heading']))return;
    if(await this.click(labels.signins)){await this.waitForControl(labels.signins,['heading']);return;}
    await this.click(labels.entra);
    await new Promise(r=>setTimeout(r,500));
    await this.click(labels.monitoring);
    await new Promise(r=>setTimeout(r,500));
    if(!await this.click(labels.signins))throw issue(409,'Sign-in logs menüsü bulunamadı. Otomasyon tarayıcısında Entra ID → Monitoring & health → Sign-in logs ekranını açın; ardından tekrar devam edin.');
    await this.waitForControl(labels.signins,['heading']);
  }
  async selectSevenDays() {
    this.assertPortal();
    // Page-specific controls must be visible before a download is attempted.
    if(!await this.find(labels.signins,['heading']))throw issue(409,'Giriş logları ekranı henüz hazır değil. Otomasyon tarayıcısında Sign-in logs ekranını açıp devam edin.');
    if(await this.find(labels.appliedSeven,['button']))return;
    if(!await this.click(labels.date,['button']))throw issue(409,'Tarih filtresi bulunamadı. Otomasyon tarayıcısında Date/Tarih filtresini Last 7 days/Son 7 gün yapıp devam edin.');
    const seven=await this.waitForControl(labels.seven,['option','menuitem','menuitemradio','radio','button']);
    if(!seven)throw issue(409,'Son 7 gün seçeneği bulunamadı. Portalda tarih filtresini seçip Apply/Uygula düğmesine basın, sonra devam edin.');
    await seven.click();
    await this.click(labels.apply,['button']);
    const deadline=Date.now()+10000;
    do {
      if(await this.find(labels.appliedSeven,['button']))return;
      await new Promise(r=>setTimeout(r,400));
    }while(Date.now()<deadline);
    throw issue(409,'Son 7 gün filtresinin uygulandığı doğrulanamadı. Portalda Date: Last 7 days / Tarih: Son 7 gün etiketini kontrol edin.');
  }
  async download() {
    this.assertPortal();
    // A retry must keep waiting for the export already being prepared by Entra.
    if(this.downloadRequested||this.capturedDownload)return this.waitForPortalDownload();
    // Arm the event before any click; a JSON menu item can start the download directly.
    const pending=this.waitForPortalDownload();
    pending.catch(()=>{});
    let received=false;pending.then(()=>{received=true;},()=>{});
    // An export blade may already be open after an interrupted attempt.
    // Select its full interactive file by filename instead of a global Download.
    if(await this.submitJsonExport())return pending;
    if(!await this.click(labels.download,['menuitem','button']))throw issue(409,'Download/İndir düğmesi bulunamadı. Portal düzeni değişmiş olabilir.');
    const deadline=Date.now()+15000;
    while(!received&&Date.now()<deadline) {
      if(await this.submitJsonExport())return pending;
      const format=await this.find(/^(Format|File format|Biçim|Dosya biçimi)$/i,['combobox']);
      if(format){try{await format.selectOption({label:'JSON'});}catch{await format.click();await this.click(/^JSON$/i,['option']);}break;}
      if(await this.click(labels.json,['menuitem','option','radio','button']))break;
      await new Promise(r=>setTimeout(r,400));
    }
    if(!received){
      // Opening the JSON blade is asynchronous; wait for its file rows to render.
      const until=Date.now()+10000;
      do {
        if(await this.submitJsonExport())return pending;
        if(received)return pending;
        await new Promise(r=>setTimeout(r,250));
      }while(Date.now()<until);
    }
    // Some portal versions name each export button by category. Only full user
    // sign-ins are eligible; never click an auth-details-only/app/managed-identity export.
    if(!received)await this.click(/^(Download|İndir).*?(Interactive sign-ins|Etkileşimli (kullanıcı )?oturum açma)(?!.*(details|ayrıntı))/i,['button']);
    if(!received){
      // A dialog with a single full-interactive category selector has an unambiguous
      // submit action. Disable other export categories before submitting that dialog.
      const dialogs=this.page.getByRole('dialog');
      for(const dialog of await dialogs.all()){
        if(!await dialog.isVisible())continue;
        const category=dialog.getByRole('checkbox',{name:/^(Interactive sign-ins|Etkileşimli (kullanıcı )?oturum açma(lar|ları)?)$/i});
        const buttons=dialog.getByRole('button',{name:labels.download});
        if(await category.count()!==1||await buttons.count()!==1)continue;
        // Only a visible JSON format in the dialog is sufficient to submit.
        const json=dialog.getByText(/^JSON$/i);
        if(!await json.count())continue;
        const others=dialog.getByRole('checkbox',{name:/(non-interactive|authentication details|application sign-ins|managed identity|etkileşimli olmayan|kimlik doğrulama ayrıntıları|uygulama oturum|yönetilen kimlik)/i});
        for(const other of await others.all())await other.uncheck();
        await category.check();await buttons.click();break;
      }
    }
    return pending.catch(()=>{throw issue(409,'Portal indirme onayı bekliyor veya indirme zaman aşımına uğradı. Otomasyon tarayıcısında tam kullanıcı logları için JSON indirmesini başlatın; panelde “Portal indirmesini dinle” seçeneğini kullanabilirsiniz.');});
  }
  async submitJsonExport(){
    this.assertPortal();
    for(const frame of this.page.frames()){
      if(frame!==this.page.mainFrame()&&!/^https:\/\/([a-z0-9-]+\.)*(entra\.microsoft\.com|azure\.com|azure\.net)\//i.test(frame.url()))continue;
      const panels=frame.getByRole('complementary',{name:/^Download Sign-ins in JSON format$/i});
      for(const panel of await panels.all()){
        if(!await panel.isVisible())continue;
        const files=panel.getByRole('textbox',{name:/^File Name$/i});
        if(await files.count()===0)return false;
        const interactive=[];
        for(const field of await files.all()){
          if(await field.isVisible()&&/^InteractiveSignIns(?:_|$)/i.test(await field.inputValue()))interactive.push(field);
        }
        if(interactive.length!==1)throw issue(409,'JSON panelinde tam etkileşimli giriş dosyası tekil olarak bulunamadı.');
        // Find the smallest file row with one textbox and one Download button.
        // Never choose by button order: other rows export non-interactive/MSI data.
        let row=interactive[0];
        for(let depth=0;depth<8;depth++){
          row=row.locator('..');
          if(await row.getByRole('textbox').count()>1)break;
          const buttons=row.getByRole('button',{name:labels.download});
          if(await buttons.count()===1&&await buttons.isVisible()&&await buttons.isEnabled()){
            this.downloadRequested=true;
            try{await buttons.click();}catch(e){this.downloadRequested=false;throw e;}
            return true;
          }
        }
        // The current Entra blade renders labels, fields and buttons as siblings,
        // without a row wrapper. Pair each file field with its following Download
        // before the next file field; reject missing/duplicate associations.
        const controls=files.or(panel.getByRole('button',{name:labels.download}));
        let filename=null;const candidates=[];
        for(const control of await controls.all()){
          if(!await control.isVisible())continue;
          if(await control.evaluate(el=>el.matches('input,textarea'))){filename=await control.inputValue();continue;}
          if(/^InteractiveSignIns(?:_|$)/i.test(filename||''))candidates.push(control);
        }
        if(candidates.length===1&&await candidates[0].isEnabled()){
          this.downloadRequested=true;
          try{await candidates[0].click();}catch(e){this.downloadRequested=false;throw e;}
          return true;
        }
        throw issue(409,'Etkileşimli JSON dosyasının indirme düğmesi henüz hazır değil.');
      }
    }
    return false;
  }
  waitForPortalDownload(timeout=600000){
    if(this.capturePage!==this.page){
      this.capturePage?.off('download',this.captureHandler);
      this.capturePage=this.page;this.downloadWaiters=new Set();
      this.captureHandler=download=>{
        this.downloadRequested=false;
        if(this.downloadWaiters.size){for(const waiter of [...this.downloadWaiters])waiter.resolve(download);}
        else this.capturedDownload=download;
      };
      this.page.on('download',this.captureHandler);
    }
    if(this.capturedDownload){const download=this.capturedDownload;this.capturedDownload=null;return Promise.resolve(download);}
    return new Promise((resolve,reject)=>{
      const waiter={resolve:download=>{clearTimeout(timer);this.downloadWaiters.delete(waiter);resolve(download);}};
      const timer=setTimeout(()=>{this.downloadWaiters.delete(waiter);reject(issue(409,'Entra 10 dakika içinde dosyayı hazırlamadı. Oturumu açık bırakıp devam ederek aynı indirmeyi bekleyebilir veya daha kısa tarih aralığı kullanabilirsiniz.'));},timeout);
      timer.unref?.();this.downloadWaiters.add(waiter);
    });
  }
  async listenDownload(){this.assertPortal();return this.waitForPortalDownload();}
}

export async function readDownload(download,maxBytes=25*1024*1024) {
  if(!/\.json$/i.test(download.suggestedFilename()))throw issue(400,'Portal JSON dışında bir dosya indirdi. JSON biçimini seçin.');
  const error=await download.failure();if(error)throw issue(400,'Portal dosya indirmesi tamamlanamadı.');
  const stream=await download.createReadStream();if(!stream)throw issue(400,'İndirilen dosya okunamadı.');
  const chunks=[];let bytes=0;
  for await(const chunk of stream){bytes+=chunk.length;if(bytes>maxBytes){stream.destroy();throw issue(413,'Portal çıktısı 25 MB sınırını aşıyor. Manuel aktarımda daha küçük tarih aralığı kullanın.');}chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,''));}
  catch{throw issue(400,'Portal geçerli bir JSON dosyası üretmedi.');}
}

export class PortalAutomation {
  constructor({driverFactory=()=>new EdgePortalDriver(),support=browserSupport,importEvents}) {
    this.driverFactory=driverFactory;this.support=support;this.importEvents=importEvents;
    this.driver=null;this.job=null;this.running=false;
  }
  status(){
    if(!this.running&&this.driver?.health?.().closed){
      const driver=this.driver;const diagnostic=driver.health();this.driver=null;void driver.close('disconnected_cleanup').catch(()=>{});
      this.job={...this.job,phase:'browser_closed',message:'Otomasyona ait otomasyon penceresi kapandı veya bağlantısı kesildi. Aşağıdaki başlat düğmesiyle yeni oturum açabilirsiniz. Başka tarayıcıdaki Entra sekmesi bu oturuma bağlı değildir.'};
      this.job.diagnostic=diagnostic;
    }
    return {...this.support(),...(this.job||{phase:'idle',message:'Başlatılmadı.'})};
  }
  active(){return !!this.driver;}
  async start(tenantId) {
    if(!UUID.test(tenantId))throw issue(400,'Geçerli tenant bağlantısı gerekli.');
    if(this.active()||this.running)throw issue(409,'Bir portal oturumu zaten açık. Devam edin veya iptal edin.');
    const support=this.support();if(!support.available)throw issue(409,support.reason);
    this.job={id:randomUUID(),phase:'opening',tenantId,message:'Microsoft Otomasyon tarayıcısı açılıyor…',startedAt:new Date().toISOString()};
    this.driver=this.driverFactory();this.running=true;const id=this.job.id,driver=this.driver;
    try{await driver.open();if(this.job.id!==id)return;this.job.phase='awaiting_login';this.job.message='Otomasyon tarayıcısında Microsoft girişini/MFA’yı tamamlayın ve doğru tenant’ı seçin. Sonra aşağıdan devam edin.';}
    catch{const diagnostic=driver.health?.();await driver.close('opening_failed');if(this.job.id===id){this.driver=null;this.job.phase='error';this.job.diagnostic=diagnostic;this.job.message='Tarayıcı başlatılamadı. Tarayıcı kurulumunu ve kurum politikalarını kontrol edin.';}}
    finally{this.running=false;}
  }
  async continue({tenantId,confirmed,listenOnly=false}) {
    if(!this.driver||!this.job)throw issue(409,'Önce portal oturumunu başlatın.');
    if(this.running)throw issue(409,'Portal işlemi zaten sürüyor.');
    if(tenantId!==this.job.tenantId||confirmed!==true)throw issue(400,'Otomasyon tarayıcısında seçili tenant’ın bu bağlantıyla eşleştiğini doğrulayın.');
    this.running=true;const id=this.job.id,driver=this.driver;
    try {
      if(!listenOnly){this.job.phase='navigating';this.job.message='Giriş günlükleri ekranı açılıyor…';await driver.navigate();this.job.phase='filtering';this.job.message='Son 7 gün filtresi doğrulanıyor…';await driver.selectSevenDays();}
      else {await driver.recoverPage?.();await driver.selectSevenDays();}
      this.job.phase='downloading';this.job.message=listenOnly?'Otomasyon tarayıcısında JSON indirmesini başlatın. İndirilen dosya otomatik yakalanacak.':'Portalın JSON indirmesi bekleniyor. Ek onay paneli açılırsa Otomasyon tarayıcısında tam kullanıcı loglarının indirmesini tamamlayın.';
      const download=await (listenOnly?driver.listenDownload():driver.download());
      const document=await readDownload(download);
      const parsed=parseSignInImport(document),now=Date.now();
      const events=parsed.events.filter(e=>Date.parse(e.createdDateTime)>=now-7*86400000);
      if(this.job?.id!==id)throw issue(409,'Portal işlemi iptal edildi.');
      this.job.phase='importing';this.job.message='Kayıtlar doğrulanıyor ve panele aktarılıyor…';
      const result=this.importEvents(events,{tenantId,source:'portal-automation',lastImport:new Date().toISOString(),total:parsed.total,expired:parsed.expired+parsed.events.length-events.length,duplicates:parsed.duplicates,scope:'Portalda seçili kullanıcı giriş kategorisi; son 7 gün. Portal filtreleri ve dışa aktarma sınırları geçerlidir.'});
      this.job.phase='completed';this.job.message=`${result.inserted} yeni kayıt aktarıldı; ${result.existing+parsed.duplicates} tekrar atlandı.`;this.job.result=result;this.job.finishedAt=new Date().toISOString();
      await driver.close('completed');this.driver=null;
    }catch(e){if(this.job?.id===id){this.job.phase='needs_attention';this.job.message=e.status?e.message:'Portal adımı tamamlanamadı. Tarayıcı penceresindeki ekranı kontrol edip tekrar devam edin.';if(driver.health?.().closed){this.job.diagnostic=driver.health();await driver.close('disconnected_cleanup');this.driver=null;this.job.phase='browser_closed';this.job.message='Otomasyon penceresi kapandı veya bağlantısı kesildi. Başlat düğmesiyle yeni oturum açın; tanı bilgisini aşağıdan görebilirsiniz.';}}}
    finally{this.running=false;}
  }
  async cancel(){const driver=this.driver;this.driver=null;if(this.job)this.job={...this.job,id:randomUUID(),phase:'cancelled',message:'Portal işlemi iptal edildi.'};await driver?.close('cancelled');}
}
