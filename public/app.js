const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={},data=null,days=7,page='overview',search='',sort='score',offset=0,setupMode='auto',loginRole='viewer',poll=null,pendingRender=false;
function getLang(){try{return localStorage.getItem('idsignal_lang')||'tr';}catch{return 'tr';}}
function setLang(l){try{localStorage.setItem('idsignal_lang',l);}catch{}updateTitles();render();}

const fmt=n=>Number(n||0).toLocaleString(getLang()==='en'?'en-US':'tr-TR'), date=v=>v?new Date(v).toLocaleString(getLang()==='en'?'en-US':'tr-TR'):(getLang()==='en'?'None yet':'Henüz yok');
const titles={overview:'Genel Bakış',priority:'MFA Öncelikleri',recommendations:'MFA Önerileri',attacks:'Saldırı Analizi',users:'Kullanıcılar',remediation:'Acil Müdahale',sources:'Entra Bağlantısı',settings:'Ayarlar'};

function updateTitles(){
  const l=getLang();
  if(l==='en'){
    titles.overview='Overview';
    titles.priority='MFA Priorities';
    titles.recommendations='MFA Recommendations';
    titles.attacks='Attack Analysis';
    titles.users='Users';
    titles.remediation='Emergency Remediation';
    titles.sources='Entra Connection';
    titles.settings='Settings';
  }else{
    titles.overview='Genel Bakış';
    titles.priority='MFA Öncelikleri';
    titles.recommendations='MFA Önerileri';
    titles.attacks='Saldırı Analizi';
    titles.users='Kullanıcılar';
    titles.remediation='Acil Müdahale';
    titles.sources='Entra Bağlantısı';
    titles.settings='Ayarlar';
  }
}
updateTitles();

const translations={
  en:{
    workspace:'Workspace',
    admin_tag:'ADMIN',
    readonly_tag:'READ ONLY',
    admin_login:'Admin Login',
    logout:'Logout',
    collapse_menu:'Collapse Menu',
    expand_menu:'Expand Menu',
    version_str:'IDSignal · Local v0.1',
    team_view:'IDSignal Team View',

    identity_sec:'Identity Security',
    subtitle:'From attack signals to explainable review priorities.',
    monitored_users:'Monitored Users',
    no_mfa:'No MFA',
    suspected_attacks:'Suspected Attacks',
    under_control:'Under Control',
    urgent_high:'Urgent / High',
    last_24h:'Last 24 hours',
    last_7d:'Last 7 days',
    last_30d:'Last 30 days',
    export_csv:'↓ CSV Export',
    sync_now:'⟳ Sync now',
    sync_users:'⟳ Sync users',
    active:'active',
    disabled:'disabled',
    status_unknown_note:'users status unknown',
    signins_period_prefix:'In selected period',
    signins_period_suffix:'sign-ins',
    control_note:'Attack signal present, MFA enabled',
    urgent_note:'Accounts with score 50+',

    user_directory:'User Directory',
    review_priorities:'Review Priorities',
    search_placeholder:'Search user or email',
    view_all:'View all →',
    th_user:'USER',
    th_mfa:'MFA',
    th_failed:'FAILED',
    th_reason:'STATUS & THREAT REASON',
    th_score:'SCORE',
    th_threat:'THREAT INDICATOR',
    th_ip_fails:'SOURCE IP / FAILED',
    th_rec_level:'RECOMMENDATION TIER',
    remediation_btn:'⚡ Remediation Code',
    account_disabled:'Account disabled',
    pw_fails_note:'risk-associated failed passwords',
    trusted_ip:'trusted IP',
    filter_all:'All',
    filter_urgent:'Urgent / High',
    filter_score100:'Score 100',
    filter_critical:'Critical (Success)',
    filter_control:'Under Control',
    filter_review:'Review',
    filter_no_mfa:'No MFA',
    filter_signal:'Attack Signal',
    filter_mfa_yes:'MFA Enabled',
    filter_mfa_unknown:'MFA Unknown',
    filter_enabled:'Active Accounts',
    filter_disabled:'Disabled Accounts',
    prev:'Previous',
    next:'Next',
    users_lower:'users',

    reason_suspicious_success:'⊗ Suspicious Success: Successful sign-in from same IP after multiple failures!',
    reason_impossible_travel:'⊗ Impossible Travel: Sign-ins from 2 distinct countries within 1 hour',
    reason_dist_attack_no_mfa:'⊗ No MFA · Distributed attack target from 5+ distinct IPs',
    reason_dist_attack_mfa:'⊘ MFA Enabled · Attack from 5+ distinct IPs (Password Protected)',
    reason_spray_no_mfa:'⊗ No MFA · Password Spray Target',
    reason_spray_mfa:'⊘ MFA Enabled · Password Spray Target (Protected)',
    reason_no_mfa_method:'○ No Registered MFA Method',

    mfa_plan_eyebrow:'MFA Rollout Plan',
    mfa_rec_title:'MFA Recommendations',
    ca_help_link:'How to add CA Policy?',
    export_ca_json_btn:'↓ Generate Policy (JSON)',
    export_mfa_csv_btn:'↓ Recommendation List (CSV)',
    rec_table_title:'Active Accounts – Missing MFA',
    rec_urgent:'Emergency Remediation',
    rec_external:'External Threat',
    rec_monitored:'Monitored',
    rec_routine:'Routine Rollout',
    threat_suspicious_success:'Suspicious successful sign-in detected',
    threat_dist_target:'Distributed attack target',
    threat_failed_ips:'failed attempts from distinct IPs',
    threat_low_signal:'Low-level attack signal',
    threat_single_ip_fail:'failed sign-in (single IP – likely user error)',
    threat_none:'No active threat signal',

    remediation_title:'Emergency Remediation Protocol',
    master_switch_label:'Remediation Action Interlock Switch',
    switch_on:'ON (Action Buttons Visible)',
    switch_off:'OFF (Protection Mode Active)',

    entra_conn:'Entra Connection',
    m365_connect:'Connect Microsoft 365',
    entra_connect:'Connect Microsoft Entra',
    connect_api_btn:'Connect / Update API Permissions →',
    consent_btn:'Go to Entra & Grant Admin Consent ↗',
    verify_sync_btn:'Verify Connection & Fetch Logs',
    save_creds_btn:'Save Credentials Securely →',

    settings_title:'Settings',
    auto_sync:'Automatic Sync Interval',
    historical_range:'Historical Range for First Sync',
    trusted_ips:'Trusted IP Addresses and Networks',
    viewer_pass:'Read-Only Team Password',
    save_settings:'Save Settings',
    disabled_opt:'Disabled',
    min15_opt:'Every 15 minutes',
    min30_opt:'Every 30 minutes',
    hourly_opt:'Hourly',

    welcome_title:'Identity Security Workspace',
    sign_in:'Sign In →',
    create_workspace:'Create Workspace →'
  }
};

function t(key, fallback) {
  const l = getLang();
  if (l === 'tr') return fallback || key;
  return translations.en?.[key] || fallback || key;
}
const hexIconSvg = `<svg class="nav-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L20 7.5v9L12 21l-8-4.5v-9L12 3z"/></svg>`;
const navIcons={overview:'◫',priority:'◎',recommendations:'🛡',attacks:'⌁',users:'♙',remediation:hexIconSvg,sources:'⟳',settings:'⚙'};
const fxSvgHTML={
  overview:`<div class="fx-radar-sweep"></div><div class="fx-radar-grid"></div>`,
  priority:`<div class="fx-voltage-glow"></div><svg class="fx-svg" viewBox="0 0 200 36" preserveAspectRatio="none"><path class="fx-amber-arc" fill="none" d="M0,18 L40,10 L70,26 L110,8 L150,24 L200,14"/><path class="fx-amber-arc-core" fill="none" d="M0,18 L40,10 L70,26 L110,8 L150,24 L200,14"/></svg>`,
  recommendations:`<div class="fx-plasma-wave"></div><div class="fx-shield-grid"></div>`,
  attacks:`<div class="fx-laser-line"></div><div class="fx-threat-pulse"></div>`,
  users:`<div class="fx-bio-scanline"></div>`,
  remediation:`<div class="fx-flash-glow"></div><svg class="fx-svg" viewBox="0 0 200 36" preserveAspectRatio="none"><path class="fx-bolt fx-bolt-1" fill="none" d="M 22,-5 L 14,8 L 26,14 L 12,26 L 20,40"/><path class="fx-bolt-core fx-bolt-1-core" fill="none" d="M 22,-5 L 14,8 L 26,14 L 12,26 L 20,40"/><path class="fx-bolt fx-bolt-2" fill="none" d="M 95,-5 L 108,9 L 92,17 L 110,26 L 98,40"/><path class="fx-bolt-core fx-bolt-2-core" fill="none" d="M 95,-5 L 108,9 L 92,17 L 110,26 L 98,40"/><path class="fx-bolt fx-bolt-3" fill="none" d="M 165,-5 L 152,11 L 168,18 L 155,40"/><path class="fx-bolt-core fx-bolt-3-core" fill="none" d="M 165,-5 L 152,11 L 168,18 L 155,40"/></svg>`,
  sources:`<div class="fx-data-stream"></div><div class="fx-matrix-dots"></div>`,
  settings:`<div class="fx-gear-aura"></div>`
};
function isRemediationEnabled(){try{return localStorage.getItem('idsignal_remediation_enabled')==='true';}catch{return false;}}
function setRemediationEnabled(v){try{localStorage.setItem('idsignal_remediation_enabled',v?'true':'false');}catch{}}
function getLightningSettings(){try{const raw=localStorage.getItem('idsignal_lightning_fx');if(raw){const p=JSON.parse(raw);if(typeof p.opacity==='number'&&typeof p.speed==='number'&&typeof p.angle==='number')return p;}}catch{}return {opacity:0.70,speed:3.2,angle:-9};}
function applyLightningSettings(s){document.documentElement.style.setProperty('--lightning-opacity',s.opacity);document.documentElement.style.setProperty('--lightning-speed',s.speed+'s');document.documentElement.style.setProperty('--lightning-angle',s.angle+'deg');}
function setLightningSettings(s){try{localStorage.setItem('idsignal_lightning_fx',JSON.stringify(s));}catch{}applyLightningSettings(s);}
applyLightningSettings(getLightningSettings());
function isSidebarCollapsed(){try{return localStorage.getItem('idsignal_sidebar_collapsed')==='true';}catch{return false;}}
function setSidebarCollapsed(v){try{localStorage.setItem('idsignal_sidebar_collapsed',v?'true':'false');}catch{}applySidebarState();}
function toggleSidebar(){setSidebarCollapsed(!isSidebarCollapsed());}
function applySidebarState(){
  const collapsed=isSidebarCollapsed();
  const shell=$('.app-shell');
  const btn=$('#toggle-sidebar');
  if(shell) shell.classList.toggle('sidebar-collapsed', collapsed);
  if(btn){
    btn.textContent=collapsed?'⇉':'⇇';
    btn.setAttribute('title', collapsed?'Menüyü Genişlet':'Menüyü Daralt');
  }
}
const brand=`<div class="brand"><img class="brand-logo" src="/logo.png" alt="IDSignal"></div>`;
async function api(path,body){const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':state.csrf||''},body:body===undefined?undefined:JSON.stringify(body)});const b=await r.json();if(!r.ok){if(r.status===401 && path!=='login'){state.authenticated=false;render();}throw Error(b.error||'İşlem başarısız.');}return b;}
function notify(message,error=false){$('#notice').textContent=message;$('#notice').className='visible'+(error?' error':'');setTimeout(()=>$('#notice').className='',7000);}
async function action(fn,button){if(button)button.disabled=true;try{await fn();}catch(e){notify(e.message,true);}finally{if(button)button.disabled=false;}}
async function refresh(){state=await api('status');if(state.authenticated)data=await api('dashboard?days='+days);}
function welcome(){
  const isEn = getLang() === 'en';
  const first=!state.initialized,shared=state.shared&&!first,admin=loginRole==='admin'||!shared;
  const eyebrowTxt = admin ? (isEn ? 'Admin Access' : 'Yönetim erişimi') : (isEn ? 'Team Access' : 'Ekip paylaşımı');
  const titleTxt = isEn ? 'Identity Security<br>Workspace' : 'Kimlik güvenliği<br>çalışma alanı';
  const descTxt = isEn ? 'Track sign-in events, MFA registration status, and review priorities in a single dashboard.' : 'Giriş olaylarını, MFA durumunu ve inceleme önceliklerini tek panelde takip edin.';
  const footTxt = admin ? (isEn ? 'Admin session' : 'Yönetici oturumu') : (isEn ? 'Read-only team access' : 'Salt okunur ekip erişimi');
  const btnAdmin = isEn ? 'Admin Sign-in' : 'Yönetici girişi';
  const btnViewer = isEn ? 'Back to Team Sign-in' : 'Ekip girişine dön';
  const h2Txt = first ? (isEn ? 'Welcome to IDSignal' : 'IDSignal’a hoş geldiniz') : admin ? (isEn ? 'Admin Sign-in' : 'Yönetici girişi') : (isEn ? 'Team Panel Sign-in' : 'Ekip paneline giriş');
  const pTxt = first ? (isEn ? 'First, set up your local admin password.' : 'Önce yerel yönetici parolanızı oluşturun.') : admin ? (isEn ? 'Enter your admin password for settings and Entra connection.' : 'Ayarlar ve Entra bağlantısı için yönetici parolasını girin.') : (isEn ? 'Enter the team password for read-only panel access.' : 'Salt okunur panel için ekip parolasını girin.');
  const labelPass = (admin ? (isEn ? 'Admin' : 'Yönetici') : (isEn ? 'Team' : 'Ekip')) + (isEn ? ' password' : ' parolası');
  const labelConfirm = isEn ? 'Re-enter password' : 'Parolayı tekrar girin';
  const submitTxt = first ? (isEn ? 'Create Workspace →' : 'Çalışma alanını oluştur →') : (isEn ? 'Sign In →' : 'Oturum aç →');
  const hintTxt = (admin ? (isEn ? 'Connections and settings can be changed in an admin session.' : 'Yönetici oturumunda bağlantı ve ayarlar değiştirilebilir.') : (isEn ? 'Team session is for viewing only.' : 'Ekip oturumu görüntüleme amaçlıdır.')) + (isEn ? ' Session expires after 8 hours.' : ' Oturum 8 saat sonra sona erer.');

  return `<div class="welcome"><section class="story">${brand}<div><div class="radar" aria-hidden="true"></div><div class="eyebrow">${eyebrowTxt}</div><h1>${titleTxt}</h1><p>${descTxt}</p></div><div class="foot">${footTxt}</div></section><section class="entry"><div class="entry-inner"><div class="actions login-switch">${shared?`<button class="btn ${admin?'selected':''}" id="admin-mode">${btnAdmin}</button>${admin?`<button class="btn" id="viewer-mode">${btnViewer}</button>`:''}`:''}</div><h2>${h2Txt}</h2><p>${pTxt}</p><form id="auth-form"><input type="hidden" name="role" value="${admin?'admin':'viewer'}"><label for="password">${labelPass}</label><input id="password" name="password" type="password" autocomplete="current-password" minlength="${first?12:1}" maxlength="128" required>${first?`<label for="confirm">${labelConfirm}</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required>`:''}<button class="btn primary wide" type="submit">${submitTxt}</button></form><p class="hint">${hintTxt}</p></div></section></div>`;
}
function shell(){
  const brandHeader=`<div class="sidebar-brand-header">${brand}<button type="button" id="toggle-sidebar" class="sidebar-toggle-btn" title="${isSidebarCollapsed() ? t('expand_menu', 'Menüyü Genişlet') : t('collapse_menu', 'Menüyü Daralt')}" aria-label="Menüyü Daralt veya Genişlet">${isSidebarCollapsed()?'⇉':'⇇'}</button></div>`;
  const collapsedHeaderInfo = `<div class="topbar-collapsed-info"><div class="topbar-brand">${brand}</div><div class="topbar-meta"><span class="tag ${connectionReady()?'':'pending'}">${connectionLabel()}</span><span class="topbar-version">${t('version_str', 'IDSignal · Yerel sürüm 0.1')}</span><span class="topbar-signature">Sertaç Canbey</span></div></div>`;
  const langSwitch = `<div class="lang-switch-group"><button type="button" class="lang-btn ${getLang()==='tr'?'active':''}" data-lang="tr">TR</button><button type="button" class="lang-btn ${getLang()==='en'?'active':''}" data-lang="en">EN</button></div>`;
  return `<div class="app-shell ${isSidebarCollapsed()?'sidebar-collapsed':''}"><aside class="sidebar">${brandHeader}<div><div class="eyebrow">${t('workspace', 'Çalışma alanı')}</div><nav class="spacer">${Object.entries(titles).filter(([k])=>!state.readOnly||!['remediation','sources','settings'].includes(k)).map(([k,v])=>`<a href="#${k}" class="nav-${k} ${k==='remediation'?'nav-lightning':''} ${page===k?'active':''}" title="${v}"><div class="fx-layer fx-${k}-layer" aria-hidden="true">${fxSvgHTML[k]||''}</div><span class="nav-icon-wrap">${navIcons[k]||'•'}</span><span class="nav-label">${v}</span></a>`).join('')}</nav></div><div class="bottom"><span class="tag ${connectionReady()?'':'pending'}">${connectionLabel()}</span><p>${esc(state.connection?.tenantId||t('team_view', 'IDSignal ekip görünümü'))}</p><div class="sidebar-version">${t('version_str', 'IDSignal · Yerel sürüm 0.1')}</div><div class="sidebar-signature">Sertaç Canbey</div></div></aside><main><header class="topbar"><small class="topbar-breadcrumb">${t('workspace', 'Çalışma alanı')} / <strong>${titles[page]}</strong></small>${collapsedHeaderInfo}<div class="actions">${langSwitch}<span class="tag">${state.readOnly ? t('readonly_tag', 'SALT OKUNUR') : t('admin_tag', 'YÖNETİCİ')}</span>${state.readOnly ? `<button class="btn" id="admin-login">${t('admin_login', 'Yönetici girişi')}</button>` : ''}<button class="btn" id="logout">${t('logout', 'Çıkış')}</button></div></header><div class="content" id="content">${content()}</div></main></div>`;
}
function content(){if(page==='sources')return sources();if(page==='settings')return settings();if(page==='recommendations')return recommendationsPanel();if(page==='remediation')return remediationPage();return dashboard();}

let syncStartTime = null;

function updateSyncTimerUI() {
  const isEn = getLang() === 'en';
  const box = document.getElementById('sync-timer-label');
  if (!box || !syncStartTime) return;
  const s = state.sync || {};
  const elapsed = Math.max(1, Math.floor((Date.now() - syncStartTime) / 1000));
  const elMin = Math.floor(elapsed / 60);
  const elSec = elapsed % 60;
  const elStr = `${String(elMin).padStart(2,'0')}:${String(elSec).padStart(2,'0')}`;

  const m = (s.progress || '').match(/([\d\.]+)\s*\/\s*([\d\.]+)/);
  let remStr = isEn ? 'Calculating…' : 'Hesaplanıyor…';
  if (m) {
    const cur = parseInt(m[1].replace(/\./g, ''), 10);
    const tot = parseInt(m[2].replace(/\./g, ''), 10);
    if (cur > 0 && tot > cur) {
      const rate = cur / elapsed;
      const remSecTotal = Math.ceil((tot - cur) / rate);
      const remMin = Math.floor(remSecTotal / 60);
      const remSec = remSecTotal % 60;
      remStr = remMin > 0 ? (isEn ? `~${remMin} min ${remSec} sec` : `~${remMin} dk ${remSec} sn`) : (isEn ? `~${remSec} sec` : `~${remSec} sn`);
    } else if (cur >= tot && tot > 0) {
      remStr = isEn ? 'Completing…' : 'Tamamlanıyor…';
    }
  }
  const elapsedTxt = isEn ? 'Elapsed' : 'Geçen';
  const remTxt = isEn ? 'Est. Remaining' : 'Tahmini Kalan';
  box.innerHTML = `⏱️ ${elapsedTxt}: <strong>${elStr}</strong> · ${remTxt}: <strong>${remStr}</strong>`;
}

setInterval(() => {
  if (state?.sync?.busy) updateSyncTimerUI();
}, 1000);

function syncBanner(){
  const isEn = getLang() === 'en';
  const s = state.sync || {};
  if (!s.busy) {
    syncStartTime = null;
    return s.error && (s.mode || 'premium') === (state.config?.mode || 'premium')
      ? `<div class="banner error">${esc(s.error)}${s.lastSuccess ? (isEn ? `<br>Showing data from last successful sync: ${date(s.lastSuccess)}` : `<br>Son başarılı eşitlemenin verileri gösteriliyor: ${date(s.lastSuccess)}`) : ''}</div>`
      : '';
  }
  if (!syncStartTime) syncStartTime = Date.now();

  const m = (s.progress || '').match(/([\d\.]+)\s*\/\s*([\d\.]+)/);
  let pct = 0;
  let cur = 0, tot = 0;
  if (m) {
    cur = parseInt(m[1].replace(/\./g, ''), 10);
    tot = parseInt(m[2].replace(/\./g, ''), 10);
    if (tot > 0) pct = Math.min(100, Math.round((cur / tot) * 100));
  }

  const elapsed = Math.max(1, Math.floor((Date.now() - syncStartTime) / 1000));
  const elMin = Math.floor(elapsed / 60);
  const elSec = elapsed % 60;
  const elStr = `${String(elMin).padStart(2,'0')}:${String(elSec).padStart(2,'0')}`;

  let remStr = isEn ? 'Calculating…' : 'Hesaplanıyor…';
  if (cur > 0 && tot > cur) {
    const rate = cur / elapsed;
    const remSecTotal = Math.ceil((tot - cur) / rate);
    const remMin = Math.floor(remSecTotal / 60);
    const remSec = remSecTotal % 60;
    remStr = remMin > 0 ? (isEn ? `~${remMin} min ${remSec} sec` : `~${remMin} dk ${remSec} sn`) : (isEn ? `~${remSec} sec` : `~${remSec} sn`);
  } else if (pct === 100) {
    remStr = isEn ? 'Completing…' : 'Tamamlanıyor…';
  }

  const elapsedTxt = isEn ? 'Elapsed' : 'Geçen';
  const remTxt = isEn ? 'Est. Remaining' : 'Tahmini Kalan';
  const syncProgressTxt = isEn ? 'Syncing…' : 'Eşitleme yapılıyor…';

  return `<div class="banner pulse sync-banner">
    <div class="sync-banner-row">
      <div>🔄 <strong>${esc(s.progress || syncProgressTxt)}</strong> ${pct > 0 ? `<span class="tag sync-pct">%${pct}</span>` : ''}</div>
      <div class="sync-timer-box" id="sync-timer-label">⏱️ ${elapsedTxt}: <strong>${elStr}</strong> · ${remTxt}: <strong>${remStr}</strong></div>
    </div>
    ${pct > 0 ? `<svg class="sync-progress-svg" viewBox="0 0 100 4" preserveAspectRatio="none"><rect width="100" height="4" fill="rgba(255,255,255,0.1)" rx="2"/><rect width="${pct}" height="4" fill="#00ff87" rx="2"/></svg>` : ''}
  </div>`;
}

function drawSparkline(dataTrend, key, color) {
  if (!dataTrend || dataTrend.length < 2) return '';
  const max = Math.max(...dataTrend.map(d => d[key]), 1);
  const w = 100, h = 26;
  const dx = w / (dataTrend.length - 1);
  const pts = dataTrend.map((d, i) => `${(i * dx).toFixed(1)},${(h - (d[key] / max) * (h - 6) - 3).toFixed(1)}`);
  const poly = pts.join(' ');
  const areaPts = `0,${h} ` + poly + ` 100,${h}`;
  return `<svg class="sparkline" viewBox="0 0 100 26" preserveAspectRatio="none">
    <polygon points="${areaPts}" fill="${color}" opacity="0.15"/>
    <polyline points="${poly}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function trendText(cur, prev) {
  if (prev == null || prev === 0) return '';
  const diff = cur - prev;
  const pct = Math.round((Math.abs(diff)/prev)*100);
  const isEn = getLang() === 'en';
  if (isEn) {
    if (diff > 0) return ` (+${pct}% 📈)`;
    if (diff < 0) return ` (-${pct}% 📉)`;
    return ` (No change)`;
  }
  if (diff > 0) return ` (+%${pct} 📈)`;
  if (diff < 0) return ` (-%${pct} 📉)`;
  return ` (Değişmedi)`;
}
function dashboard(){
  const isEn = getLang() === 'en';
  const m = data?.metrics || {};

  const periodOptions = [1,7,30].map(n => `<option value="${n}" ${n===days?'selected':''}>${isEn ? (n===1?'Last 24 hours':`Last ${n} days`) : (n===1?'Son 24 saat':`Son ${n} gün`)}</option>`).join('');
  const exportBtnTxt = isEn ? '↓ CSV Export' : '↓ CSV';
  const syncBtnTxt = freeMode() ? (isEn ? '⟳ Sync users' : '⟳ Kullanıcıları eşitle') : (isEn ? '⟳ Sync now' : '⟳ Şimdi eşitle');

  const bannerText = auditMode()
    ? (isEn
        ? `Source: Microsoft 365 Audit API · ${esc(state.sync?.auditMessage || 'Waiting for initial sync.')}<br>Last Audit sync: ${date(state.sync?.auditLastSuccess)} · Last MFA method check: ${date(state.sync?.mfaLastSuccess)}.${state.sync?.mfaError ? `<br><strong>MFA failed:</strong> ${esc(state.sync.mfaError)}` : ''}`
        : `Kaynak: Microsoft 365 Audit API · ${esc(state.sync?.auditMessage||'İlk eşitleme bekleniyor.')}<br>Son Audit eşitlemesi: ${date(state.sync?.auditLastSuccess)} · Son MFA yöntem kontrolü: ${date(state.sync?.mfaLastSuccess)}.${state.sync?.mfaError?`<br><strong>MFA alınamadı:</strong> ${esc(state.sync.mfaError)}`:''}`)
    : freeMode()
    ? (isEn
        ? `Free mode: log analysis relies on your imported files. <a href="#sources">Import JSON logs →</a><br>Last file import: ${date(state.import?.lastImport)} · Last directory sync: ${date(state.sync?.lastDirectorySuccess)}`
        : `Ücretsiz mod: log analizi içeri aktardığınız dosyalara dayanır. <a href="#sources">JSON loglarını aktar →</a><br>Son dosya aktarımı: ${date(state.import?.lastImport)} · Son dizin eşitlemesi: ${date(state.sync?.lastDirectorySuccess)}`)
    : '';

  const noConnText = isEn
    ? `<section class="panel"><div class="empty"><b>Let's build your initial security overview</b>Connect your Entra environment to see real users, MFA registrations, and sign-in signals here.<br><a href="#sources" class="btn primary">Connect Microsoft Entra →</a></div></section>`
    : `<section class="panel"><div class="empty"><b>İlk güvenlik görünümünüzü oluşturalım</b>Entra ortamını bağladığınızda gerçek kullanıcılar, MFA kayıtları ve giriş sinyalleri burada görünecek.<br><a href="#sources" class="btn primary">Microsoft Entra’yı bağla →</a></div></section>`;

  const warnText = isEn ? 'No successful data collection yet.' : 'Henüz başarılı veri toplama yok.';

  const m1Label = isEn ? 'Monitored Users' : 'İzlenen kullanıcı';
  const m1Note = isEn ? `${fmt(m.usersEnabled||m.users)} active · ${fmt(m.usersDisabled||0)} disabled` : `${fmt(m.usersEnabled||m.users)} etkin · ${fmt(m.usersDisabled||0)} devre dışı`;
  
  const freeMfaMetric = isEn
    ? `<section class="metric"><small>MFA Registration Status</small><strong>—</strong><p>Not collected in this mode</p></section>`
    : `<section class="metric"><small>MFA kayıt bilgisi</small><strong>—</strong><p>Bu modda alınmıyor</p></section>`;

  const m2Label = isEn ? 'No MFA' : 'MFA yok';
  const m2Note = isEn ? `${fmt(m.mfaUnknown)} users status unknown` : `${fmt(m.mfaUnknown)} kullanıcının durumu bilinmiyor`;

  const m3Label = isEn ? 'Suspected Attacks' : 'Saldırı şüphesi';
  const m3Note = isEn ? `In selected period ${fmt(m.events)} sign-ins${trendText(m.events, m.prevEvents)}` : `Seçilen dönemde ${fmt(m.events)} giriş${trendText(m.events, m.prevEvents)}`;

  const m4Label = isEn ? 'Under Control' : 'Kontrol';
  const m4Note = isEn ? 'Attack signal present, MFA enabled' : 'Saldırı sinyali var, MFA etkin';

  const m5Label = isEn ? 'Urgent / High' : 'Acil / yüksek';
  const m5Note = isEn ? 'Accounts with score 50+' : 'Skoru 50 ve üzeri hesaplar';

  const footerText = isEn
    ? `Last successful data collection: ${date(auditMode()?state.sync?.auditLastSuccess:freeMode()?state.sync?.lastDirectorySuccess:state.sync?.lastSuccess)} · Analysis period: last ${days} days.<br>Scores are IDSignal heuristics; not Microsoft risk scores or confirmed attacks. Enabled MFA does not remove the attack signal; since the password is not considered compromised, it lowers priority to "Under Control".${state.sync?.since?`<br>Collection start date: ${date(state.sync.since)}. History may be incomplete due to retention policies and reporting delays.`:''}`
    : `Son başarılı veri toplama: ${date(auditMode()?state.sync?.auditLastSuccess:freeMode()?state.sync?.lastDirectorySuccess:state.sync?.lastSuccess)} · Analiz dönemi: son ${days} gün.<br>Skorlar IDSignal sezgisidir; Microsoft risk skoru veya doğrulanmış saldırı değildir. MFA etkin olması saldırı sinyalini kapatmaz; parola aşılmış sayılmadığı için “Kontrol” önceliğine indirir.${state.sync?.since?`<br>Bu kurulumun toplama başlangıcı: ${date(state.sync.since)}. Microsoft’un saklama süresi ve rapor gecikmeleri nedeniyle geçmiş eksik olabilir.`:''}`;

  return `<div class="heading"><div><div class="eyebrow">${isEn?'IDENTITY SECURITY':'Kimlik güvenliği'}</div><h1>${titles[page]}</h1><p>${isEn?'From attack signals to explainable review priorities.':'Saldırı sinyalinden açıklanabilir inceleme önceliğine.'}</p></div><div class="actions"><select id="period" aria-label="Analiz dönemi">${periodOptions}</select><button class="btn" id="export">${exportBtnTxt}</button><button class="btn primary" id="sync" ${!state.connection||state.sync?.busy?'disabled':''}>${syncBtnTxt}</button></div></div>${syncBanner()}${bannerText ? `<div class="banner">${bannerText}</div>` : ''}${!state.connection&&!state.readOnly?noConnText:''}${state.connection&&!(freeMode()?state.sync?.lastDirectorySuccess:state.sync?.lastSuccess)?`<div class="banner warn">${warnText}</div>`:''}<div class="metrics">${metric(m1Label,m.users,m1Note,'','users', drawSparkline(data?.trend, 'events', '#00ff87'))}${freeMode()?freeMfaMetric:metric(m2Label,m.mfaMissing,m2Note,'red','recommendations')}${metric(m3Label,m.incidents,m3Note,'','attacks', drawSparkline(data?.trend, 'failures', '#ff4757'))}${metric(m4Label,m.control,m4Note,'green','priority?cat=control')}${metric(m5Label,m.priority,m5Note,'red','priority?cat=urgent')}</div>${page==='attacks'?incidents():page==='users'||page==='priority'?userPanel(false):`<div class="grid"><div>${userPanel(true)}${incidents(4)}</div><div>${coverage()}${rules()}</div></div>`}<p class="subtle">${footerText}</p>`;
}
function metric(label,value,note,cls='',link='',sparklineHtml=''){
  const norm = String(label).toLocaleLowerCase('tr-TR');
  let badgeCls = 'badge-cyan';
  let svg = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>';
  if (norm.includes('mfa')) {
    badgeCls = 'badge-amber';
    svg = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>';
  } else if (norm.includes('sald') || norm.includes('saldir') || norm.includes('tehdit') || norm.includes('attack')) {
    badgeCls = 'badge-red';
    svg = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>';
  } else if (norm.includes('kontrol') || norm.includes('control')) {
    badgeCls = 'badge-green';
    svg = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>';
  } else if (norm.includes('acil') || norm.includes('yük') || norm.includes('yuk') || norm.includes('skor') || norm.includes('urgent') || norm.includes('high')) {
    badgeCls = 'badge-red';
    svg = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
  }
  return `<section class="metric ${link?'clickable':''}" ${link?`data-link="${link}"`:''}>
    <div class="metric-info">
      <small>${label}</small>
      <strong class="${cls}">${fmt(value)}</strong>
      <p title="${note}">${note}</p>
    </div>
    <div class="metric-badge ${badgeCls}">${svg}</div>
    ${sparklineHtml || ''}
  </section>`;
}
function getFilter(){const query=location.hash.split('?')[1];return query?new URLSearchParams(query).get('cat'):null;}
function filterTabs(pageName,items){const cat=getFilter();return `<div class="filter-tabs">${items.map(([val,label,count])=>`<button class="btn ${cat===val||(cat===null&&val===null)?'selected':''}" data-filter="${val??''}">${label}${count!==undefined?' <small>('+fmt(count)+')</small>':''}</button>`).join('')}</div>`;}
const isHumanUser=u=>{const s=((u.email||'')+' '+(u.id||'')).toLowerCase();return !s.includes('||')&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((u.email||u.id||'').trim());};
function filteredUsers(){let rows=[...(data?.users||[])].filter(isHumanUser);const cat=getFilter();if(page==='priority'){if(cat==='mfa')rows=rows.filter(u=>u.mfa===false);else if(cat==='control')rows=rows.filter(u=>u.reviewState==='control');else if(cat==='urgent')rows=rows.filter(u=>u.score>=50);else if(cat==='critical')rows=rows.filter(u=>u.reviewState==='critical');else if(cat==='score100')rows=rows.filter(u=>u.score===100);else if(cat==='review')rows=rows.filter(u=>u.reviewState==='review');else if(cat==='signal')rows=rows.filter(u=>u.score>0);else rows=rows.filter(u=>u.score>0||u.mfa===false);}if(page==='users'){if(cat==='mfa-yes')rows=rows.filter(u=>u.mfa===true);else if(cat==='mfa-no')rows=rows.filter(u=>u.mfa===false);else if(cat==='mfa-unknown')rows=rows.filter(u=>u.mfa===null);else if(cat==='enabled')rows=rows.filter(u=>u.enabled!==false);else if(cat==='disabled')rows=rows.filter(u=>u.enabled===false);}if(search){const q=search.toLocaleLowerCase('tr-TR');rows=rows.filter(u=>(u.name+' '+u.email).toLocaleLowerCase('tr-TR').includes(q));}rows.sort(sort==='fails'?(a,b)=>b.fails-a.fails||b.score-a.score:sort==='name'?(a,b)=>a.name.localeCompare(b.name,'tr'):(a,b)=>b.score-a.score||b.fails-a.fails||a.name.localeCompare(b.name,'tr'));return rows;}
function userPanel(short){
  const isEn = getLang() === 'en';
  const all=filteredUsers(),rows=short?all.slice(0,6):all.slice(offset,offset+50);
  const users=(data?.users||[]).filter(isHumanUser);
  
  const pAll = isEn ? 'All' : 'Tümü';
  const pUrgent = isEn ? 'Urgent / High' : 'Acil / Yüksek';
  const pScore100 = isEn ? 'Score 100' : 'Skor 100';
  const pCritical = isEn ? 'Critical (Success)' : 'Kritik (Başarılı)';
  const pControl = isEn ? 'Under Control' : 'Kontrol';
  const pReview = isEn ? 'Review' : 'İncele';
  const pNoMfa = isEn ? 'No MFA' : 'MFA Yok';
  const pSignal = isEn ? 'Attack signal' : 'Saldırı sinyali';

  const uAll = isEn ? 'All' : 'Tümü';
  const uMfaYes = isEn ? 'MFA Enabled' : 'MFA Etkin';
  const uMfaNo = isEn ? 'No MFA' : 'MFA Yok';
  const uMfaUnknown = isEn ? 'MFA Unknown' : 'MFA Bilinmiyor';
  const uEnabled = isEn ? 'Active accounts' : 'Etkin hesaplar';
  const uDisabled = isEn ? 'Disabled' : 'Devre dışı';

  const priorityFilters=filterTabs('priority',[[null,pAll,users.filter(u=>u.score>0||u.mfa===false).length],['urgent',pUrgent,users.filter(u=>u.score>=50).length],['score100',pScore100,users.filter(u=>u.score===100).length],['critical',pCritical,users.filter(u=>u.reviewState==='critical').length],['control',pControl,users.filter(u=>u.reviewState==='control').length],['review',pReview,users.filter(u=>u.reviewState==='review').length],['mfa',pNoMfa,users.filter(u=>u.mfa===false).length],['signal',pSignal,users.filter(u=>u.score>0).length]]);
  
  const userFilters=filterTabs('users',[[null,uAll,users.length],['mfa-yes',uMfaYes,users.filter(u=>u.mfa===true).length],['mfa-no',uMfaNo,users.filter(u=>u.mfa===false).length],['mfa-unknown',uMfaUnknown,users.filter(u=>u.mfa===null).length],['enabled',uEnabled,users.filter(u=>u.enabled!==false).length],['disabled',uDisabled,users.filter(u=>u.enabled===false).length]]);
  
  const titleTxt = page==='users' ? (isEn?'User Directory':'Kullanıcı dizini') : (isEn?'Review Priorities':'İnceleme öncelikleri');
  const countTxt = !short ? (isEn ? `Showing ${fmt(all.length)} accounts out of ${fmt(users.length)} total users` : `Toplam ${fmt(users.length)} kullanıcıdan ${fmt(all.length)} hesap gösteriliyor`) : '';
  const searchPlaceholder = isEn ? 'Search user or email' : 'Kullanıcı veya e-posta ara';
  const viewAllTxt = isEn ? 'View all →' : 'Tümünü gör →';
  const footerCountTxt = isEn ? `${fmt(all.length)} users · ${rows.length?offset+1:0}–${offset+rows.length}` : `${fmt(all.length)} kullanıcı · ${rows.length?offset+1:0}–${offset+rows.length}`;
  const prevBtnTxt = isEn ? 'Previous' : 'Önceki';
  const nextBtnTxt = isEn ? 'Next' : 'Sonraki';

  return `<section class="panel"><div class="panel-head"><div><h2>${titleTxt}</h2>${!short?`<small>${countTxt}</small>`:''}</div>${short?`<a href="#priority">${viewAllTxt}</a>`:`<div class="actions"><input class="search" id="search" value="${esc(search)}" placeholder="${searchPlaceholder}" aria-label="Kullanıcı ara"></div>`}</div>${!short&&page==='priority'?priorityFilters:''}${!short&&page==='users'?userFilters:''}<div id="user-table">${userTable(rows)}</div>${!short?`<div class="table-footer"><span>${footerCountTxt}</span><div class="actions"><button class="btn" id="prev" ${offset===0?'disabled':''}>${prevBtnTxt}</button><button class="btn" id="next" ${offset+50>=all.length?'disabled':''}>${nextBtnTxt}</button></div></div>`:''}</section>`;
}
function filteredRecommendations(){let rows=(data?.users||[]).filter(isHumanUser).filter(u=>u.mfa===false&&u.enabled!==false);const cat=getFilter();if(cat==='critical')rows=rows.filter(u=>u.score>=50);else if(cat==='multi-ip')rows=rows.filter(u=>(u.ips||0)>=2);else if(cat==='routine')rows=rows.filter(u=>u.score===0&&(u.ips||0)<=1);if(search){const q=search.toLocaleLowerCase('tr-TR');rows=rows.filter(u=>(u.name+' '+u.email).toLocaleLowerCase('tr-TR').includes(q));}rows.sort(sort==='fails'?(a,b)=>b.fails-a.fails||b.score-a.score:sort==='name'?(a,b)=>a.name.localeCompare(b.name,'tr'):(a,b)=>b.score-a.score||(b.ips||0)-(a.ips||0)||b.fails-a.fails||a.name.localeCompare(b.name,'tr'));return rows;}
function recLevel(u){
  const isEn = getLang() === 'en';
  if(u.score>=50)return [isEn?'Emergency Remediation':'Acil Müdahale','high'];
  if((u.ips||0)>=2)return [isEn?'External Threat':'Dış Tehdit Var','mid'];
  if(u.score>0)return [isEn?'Monitored':'İzleniyor','mid'];
  return [isEn?'Routine Rollout':'Rutin Dağıtım','low'];
}
function recThreat(u){
  const isEn = getLang() === 'en';
  if(u.score>=100)return isEn?'Suspicious successful sign-in detected':'Şüpheli başarılı oturum tespit edildi';
  if(u.score>=50)return isEn?`Distributed attack target · ${u.ips||0} distinct IPs`:`Dağıtık saldırı hedefi · ${u.ips||0} farklı IP`;
  if((u.ips||0)>=2)return isEn?`failed attempts from ${u.ips} distinct IPs`:`${u.ips} farklı IP'den hatalı deneme`;
  if(u.score>0)return isEn?'Low-level attack signal':'Düşük seviye saldırı sinyali';
  if(u.fails>0)return isEn?`${u.fails} failed sign-in (single IP – likely user error)`:`${u.fails} başarısız giriş (tek IP – muhtemel kullanıcı hatası)`;
  return isEn?'No active threat signal':'Aktif tehdit sinyali yok';
}
function recommendationsPanel(){
  const isEn = getLang() === 'en';
  const base=(data?.users||[]).filter(u=>u.mfa===false&&u.enabled!==false);
  const critCount=base.filter(u=>u.score>=50).length;
  const multiIpCount=base.filter(u=>(u.ips||0)>=2).length;
  const routineCount=base.filter(u=>u.score===0&&(u.ips||0)<=1).length;
  const rows=filteredRecommendations();
  const pageRows=rows.slice(offset,offset+50);
  
  const recFilters=filterTabs('recommendations',[
    [null, isEn?'All':'Tümü', base.length],
    ['critical', isEn?'🚨 Emergency Remediation':'🚨 Acil Müdahale', critCount],
    ['multi-ip', isEn?'⚠️ Multi-IP Threat':'⚠️ Çoklu IP Tehdidi', multiIpCount],
    ['routine', isEn?'📋 Routine Rollout':'📋 Rutin Dağıtım', routineCount]
  ]);

  const titleTxt = isEn ? 'MFA Recommendations' : 'MFA Önerileri';
  const eyebrowTxt = isEn ? 'MFA Rollout Plan' : 'MFA Dağıtım Planı';
  const descTxt = isEn ? 'Only active accounts missing MFA registration; prioritized by risk score and external threat indicators.' : 'Yalnızca etkin ve MFA kaydı bulunmayan hesaplar; risk skoruna ve dış tehdit göstergelerine göre önceliklendirilmiştir.';
  const helpLinkTxt = isEn ? 'How to add CA Policy?' : 'CA Kuralı nasıl eklenir?';
  const jsonBtnTxt = isEn ? '↓ Generate Policy (JSON)' : '↓ Kural Üret (JSON)';
  const csvBtnTxt = isEn ? '↓ Recommendation List (CSV)' : '↓ Öneri Listesi (CSV)';
  const bannerTxt = isEn
    ? '<strong>Conditional Access Recommendation:</strong> The accounts below have no registered MFA method. Accounts at the <strong>Emergency Remediation</strong> level are under active attack and must have Entra ID Conditional Access policy applied immediately. <strong>External Threat</strong> accounts are targeted from multiple sources and should be required to register MFA short-term. Single-IP failed sign-ins are usually user error and fall under routine rollout.'
    : '<strong>Conditional Access Önerisi:</strong> Aşağıdaki hesaplarda kayıtlı MFA yöntemi bulunmamaktadır. <strong>Acil Müdahale</strong> seviyesindeki hesaplar aktif saldırı altında olup derhal Entra ID Conditional Access politikası uygulanmalıdır. <strong>Dış Tehdit Var</strong> seviyesindekiler birden fazla kaynaktan hedef alınmış olup kısa vadede MFA zorunlu tutulmalıdır. Tek IP kaynaklı başarısız girişler genellikle kullanıcının kendi hatalı denemesidir ve rutin dağıtım kapsamında değerlendirilir.';
  
  const tableTitle = isEn ? 'Active Accounts – Missing MFA' : 'Etkin Hesaplar – MFA Eksik';
  const tableSub = isEn ? `${fmt(base.length)} active accounts (excl. disabled and unknown MFA) · showing ${fmt(rows.length)}` : `${fmt(base.length)} etkin hesap (devre dışı ve MFA bilinmiyor hariç) · ${fmt(rows.length)} gösteriliyor`;
  const searchPlaceholder = isEn ? 'Search user or email' : 'Kullanıcı veya e-posta ara';
  const thUser = isEn ? 'USER' : 'KULLANICI';
  const thThreat = isEn ? 'THREAT INDICATOR' : 'TEHDİT GÖSTERGESİ';
  const thIpFails = isEn ? 'SOURCE IP / FAILED' : 'KAYNAK IP / BAŞARISIZ';
  const thRecLevel = isEn ? 'RECOMMENDATION TIER' : 'ÖNERİ DÜZEYİ';
  const thScore = isEn ? 'SCORE' : 'SKOR';
  const remediationBtnTxt = isEn ? '⚡ Remediation Code' : '⚡ Müdahale Kodu';
  const emptyTxt = isEn ? 'No accounts match this filter.' : 'Bu filtreye uyan hesap bulunamadı.';
  const footerCountTxt = isEn ? `${fmt(rows.length)} accounts · ${pageRows.length?offset+1:0}–${offset+pageRows.length}` : `${fmt(rows.length)} hesap · ${pageRows.length?offset+1:0}–${offset+pageRows.length}`;
  const prevBtnTxt = isEn ? 'Previous' : 'Önceki';
  const nextBtnTxt = isEn ? 'Next' : 'Sonraki';
  const subtleTxt = isEn
    ? 'This list contains only <strong>active</strong> accounts and <strong>users without MFA registration</strong>. Disabled accounts, unknown MFA status, and service accounts are excluded.'
    : 'Bu liste yalnızca <strong>etkin</strong> hesapları ve <strong>MFA kaydı olmayan</strong> kullanıcıları içerir. Devre dışı hesaplar, MFA durumu bilinmeyen hesaplar ve servis hesapları gösterilmez.';

  return `<div class="heading"><div><div class="eyebrow">${eyebrowTxt}</div><h1>${titleTxt}</h1><p>${descTxt}</p></div><div class="actions"><div><button class="inline-link" id="ca-help-btn"><small>${helpLinkTxt}</small></button></div><button class="btn" id="export-ca-json">${jsonBtnTxt}</button><button class="btn primary" id="export-mfa-rec">${csvBtnTxt}</button></div></div><div class="banner">${bannerTxt}</div><section class="panel"><div class="panel-head"><div><h2>${tableTitle}</h2><small>${tableSub}</small></div><div class="actions"><input class="search" id="search" value="${esc(search)}" placeholder="${searchPlaceholder}" aria-label="Kullanıcı ara"></div></div>${recFilters}<div class="table-wrap"><table><thead><tr><th data-sort-col="name" class="${sort==='name'?'active':''}">${thUser}</th><th>${thThreat}</th><th>${thIpFails}</th><th>${thRecLevel}</th><th data-sort-col="score" class="${sort==='score'?'active':''}">${thScore}</th></tr></thead><tbody>${pageRows.map(u=>{const rl=recLevel(u);const failDetails = u.passwordFails?fmt(u.passwordFails)+(isEn?' failed passwords':' hatalı parola'):u.fails?fmt(u.fails)+(isEn?' failed':' başarısız'):(isEn?'No failed sign-ins':'Başarısız giriş yok');return `<tr><td><button class="user-button" data-user="${esc(u.id)}"><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></button></td><td><small>${recThreat(u)}</small>${isRemediationEnabled()&&(rl[1]==='high'||u.score>=50)?`<br><button type="button" class="btn-table-action remediation-trigger-btn" data-remediation-user="${esc(u.id)}">${remediationBtnTxt}</button>`:''}</td><td>${(u.ips||0)>=2?`<strong>${u.ips} IP</strong>`:u.ips===1?'1 IP':'—'}<small>${failDetails}</small></td><td><span class="pill ${rl[1]}">${rl[0]}</span></td><td><span class="pill ${u.score>=70?'high':u.score>=40?'mid':'low'}">${u.score} / 100</span></td></tr>`;}).join('')||`<tr><td colspan="5" class="empty">${emptyTxt}</td></tr>`}</tbody></table></div><div class="table-footer"><span>${footerCountTxt}</span><div class="actions"><button class="btn" id="prev" ${offset===0?'disabled':''}>${prevBtnTxt}</button><button class="btn" id="next" ${offset+50>=rows.length?'disabled':''}>${nextBtnTxt}</button></div></div></section><p class="subtle">${subtleTxt}</p>`;
}
function reviewPill(u){
  const isEn = getLang() === 'en';
  const labels = isEn ? {
    critical: ['Urgent', 'high'],
    control: ['Control', 'mid'],
    urgent: ['High', 'high'],
    review: ['Review', 'mid'],
    'mfa-missing': ['No MFA', 'high'],
    normal: ['Normal', 'low']
  } : {
    critical: ['Acil', 'high'],
    control: ['Kontrol', 'mid'],
    urgent: ['Yüksek', 'high'],
    review: ['İncele', 'mid'],
    'mfa-missing': ['MFA yok', 'high'],
    normal: ['Normal', 'low']
  };
  const v = labels[u.reviewState] || labels.normal;
  return `<span class="pill ${v[1]}">${v[0]}</span>`;
}
function formatRiskSummary(u) {
  if (u.score === 0 && u.mfa === true) return '';
  const isEn = getLang() === 'en';
  const reasons = u.reasons || [];
  const hasFollow = reasons.some(r => r.points === 100);
  const hasTravel = reasons.some(r => r.points === 75 || r.text.includes('seyahat'));
  const hasAccountAttack = reasons.some(r => r.text.includes('dağıtık hesap'));
  const hasSpray = reasons.some(r => r.text.includes('password spray'));

  if (hasFollow) return isEn ? '⊗ Suspicious Success: Successful sign-in from same IP after multiple failures!' : '⊗ Şüpheli Başarı: Çoklu hatadan sonra aynı IP ile başarılı oturum!';
  if (hasTravel) return isEn ? '⊗ Impossible Travel: Sign-ins from 2 distinct countries within 1 hour' : '⊗ İmkansız Seyahat: 1 saatte 2 farklı ülkeden giriş';
  if (hasAccountAttack && u.mfa === false) {
    const lockStr = u.lockouts > 0 ? (isEn ? ` (${u.lockouts} Times Locked)` : ` (${u.lockouts} Kez Kilitlendi)`) : '';
    return isEn ? `⊗ No MFA · Distributed Attack from ${u.ips || 5}+ Distinct IPs${lockStr}` : `⊗ MFA Yok · ${u.ips || 5}+ Farklı IP'den Dağıtık Saldırı${lockStr}`;
  }
  if (hasAccountAttack && u.mfa === true) {
    return isEn ? `⊘ MFA Enabled · Attack from ${u.ips || 5}+ Distinct IPs (Password Protected)` : `⊘ MFA Etkin · ${u.ips || 5}+ Farklı IP'den Saldırı (Parola Korunuyor)`;
  }
  if (hasSpray && u.mfa === false) return isEn ? '⊗ No MFA · Password Spray Target' : '⊗ MFA Yok · Parola Püskürtme Hedefi';
  if (hasSpray && u.mfa === true) return isEn ? '⊘ MFA Enabled · Password Spray Target (Protected)' : '⊘ MFA Etkin · Parola Püskürtme Hedefi (Korunuyor)';
  if (u.score >= 50 && u.mfa === false) return isEn ? `⊗ No MFA · ${u.fails} Failures (${u.ips || 1} Distinct IPs)` : `⊗ MFA Yok · ${u.fails} Hata (${u.ips || 1} Farklı IP)`;
  if (u.score >= 50 && u.mfa === true) return isEn ? `⊘ MFA Enabled · ${u.fails} Failures (Monitored Account)` : `⊘ MFA Etkin · ${u.fails} Hata (Hesap İzleniyor)`;
  if (u.mfa === false) return isEn ? '○ No Registered MFA Method' : '○ Kayıtlı MFA Yöntemi Yok';
  if (reasons.length) return reasons[0].text;
  return '';
}
function userTable(rows){
  const isEn = getLang() === 'en';
  const thUser = isEn ? 'USER' : 'KULLANICI';
  const thMfa = 'MFA';
  const thFailed = isEn ? 'FAILED' : 'BAŞARISIZ';
  const thReason = isEn ? 'STATUS & THREAT REASON' : 'DURUM & TEHDİT SEBEBİ';
  const thScore = isEn ? 'SCORE' : 'SKOR';

  return rows.length ? `<div class="table-wrap"><table><thead><tr>
    <th data-sort-col="name" class="${sort==='name'?'active':''}">${thUser}</th>
    <th>${thMfa}</th>
    <th data-sort-col="fails" class="${sort==='fails'?'active':''}">${thFailed}</th>
    <th>${thReason}</th>
    <th data-sort-col="score" class="${sort==='score'?'active':''}">${thScore}</th>
  </tr></thead><tbody>${rows.map(u => {
    const summary = formatRiskSummary(u);
    const isUrgent = u.reviewState === 'urgent' || u.reviewState === 'critical' || u.score >= 50;
    const isControl = u.reviewState === 'control';
    const reasonCls = isUrgent ? 'urgent-reason' : isControl ? 'control-reason' : '';
    const fullReasons = (u.reasons || []).map(r => (r.points ? '+' + r.points + ' · ' : '') + r.text).join('\n');
    const reasonHtml = summary ? `<div class="table-reason ${reasonCls}" title="${esc(fullReasons)}">${esc(summary)}</div>` : '';
    const disabledNote = u.enabled===false ? (isEn ? '<small>Account disabled</small>' : '<small>Hesap devre dışı</small>') : '';
    const failedNote = isEn
      ? `${fmt(u.fails)}<small>${fmt(u.passwordFails)} risk-associated failed passwords${u.trustedFailures?` · ${fmt(u.trustedFailures)} trusted IP`:''}</small>`
      : `${fmt(u.fails)}<small>${fmt(u.passwordFails)} risk hesabına giren hatalı parola${u.trustedFailures?` · ${fmt(u.trustedFailures)} güvenli IP`:''}</small>`;
    const remediationBtnTxt = isEn ? '⚡ Remediation Code' : '⚡ Müdahale Kodu';

    return `<tr>
      <td>
        <button class="user-button" data-user="${esc(u.id)}">
          <strong>${esc(u.name)}</strong>
          <small>${esc(u.email)}</small>
        </button>
      </td>
      <td>${mfaPill(u.mfa)}${disabledNote}</td>
      <td>${failedNote}</td>
      <td>
        ${reviewPill(u)}
        ${reasonHtml}${isRemediationEnabled() && isUrgent ? `<button class="btn-table-action remediation-trigger-btn" data-remediation-user="${esc(u.id)}">${remediationBtnTxt}</button>` : ''}</td>
      <td><span class="pill ${u.score>=70?'high':u.score>=40?'mid':'low'}">${u.score} / 100</span></td>
    </tr>`;
  }).join('')}</tbody></table></div>` : `<div class="empty">${isEn ? 'No users in this view.' : 'Bu görünümde kullanıcı bulunmuyor.'}</div>`;
}
function mfaPill(value){
  const isEn = getLang() === 'en';
  const txt = value === true ? (isEn ? 'Enabled' : 'Etkin') : value === false ? (isEn ? 'None' : 'Yok') : (isEn ? 'Unknown' : 'Bilinmiyor');
  return `<span class="pill ${value===true?'low':value===false?'high':''}">${txt}</span>`;
}
function coverage(){
  const isEn = getLang() === 'en';
  if(freeMode()) return `<section class="panel"><div class="panel-head"><h2>${isEn ? 'MFA information not collected in this mode' : 'MFA bilgisi bu modda alınmıyor'}</h2></div><div class="panel-body"><p>${isEn ? 'User MFA registration status is displayed as unknown. MFA results in sign-in logs do not equal registered status.' : 'Kullanıcıların MFA kaydı bilinmiyor olarak gösterilir. Giriş logundaki MFA sonucu, kullanıcının kayıt durumuyla aynı şey değildir.'}</p></div></section>`;
  
  const m=data?.metrics||{},known=(m.mfaRegistered||0)+(m.mfaMissing||0),pct=known?Math.round(m.mfaRegistered/known*100):null;
  
  return `<section class="panel"><div class="panel-head"><h2>${isEn ? 'MFA Registration Coverage' : 'MFA kayıt kapsamı'}</h2></div><div class="panel-body"><div class="large">${pct===null?'—':pct+'%'}</div><p class="hint">${isEn ? `Out of ${fmt(known)} users with known status` : `Durumu bilinen ${fmt(known)} kullanıcı içinde`}</p><svg class="chart" viewBox="0 0 300 70" role="img" aria-label="${isEn ? 'MFA registration rate' : 'MFA kayıt oranı'}"><rect x="0" y="10" width="300" height="12" rx="6" opacity="0.15"/><rect x="0" y="10" width="${(pct||0)*3}" height="12" rx="6"/><text x="0" y="52">${isEn ? `${fmt(m.mfaRegistered)} registered` : `${fmt(m.mfaRegistered)} kayıtlı`}</text><text x="190" y="52">${isEn ? `${fmt(m.mfaMissing)} missing` : `${fmt(m.mfaMissing)} eksik`}</text></svg><div class="row"><span class="muted">${isEn ? 'Status unknown' : 'Bilgisi alınamayan'}</span><strong>${fmt(m.mfaUnknown)}</strong></div><p class="hint">${isEn ? 'Disabled accounts and users not in report are kept as "unknown".' : 'Devre dışı hesaplar ve raporda bulunmayan kullanıcılar "bilinmiyor" olarak korunur.'}</p></div></section>`;
}
function filteredIncidents(){let rows=data?.incidents||[];const cat=getFilter();if(cat==='spray')rows=rows.filter(i=>i.type==='spray');else if(cat==='distributed')rows=rows.filter(i=>i.type==='account');else if(cat==='travel')rows=rows.filter(i=>i.type==='travel');else if(cat==='controlled'){rows=rows.filter(i=>{const affected=i.users.map(id=>data.users.find(u=>u.id===id)).filter(Boolean);return affected.length&&affected.every(u=>u.mfa===true&&u.reviewState!=='critical');});}else if(cat==='uncontrolled'){rows=rows.filter(i=>{const affected=i.users.map(id=>data.users.find(u=>u.id===id)).filter(Boolean);return !(affected.length&&affected.every(u=>u.mfa===true&&u.reviewState!=='critical'));});}return rows;}
function drawNodeGraph(i, controlled) {
  const isEn = getLang() === 'en';
  if (i.type === 'account' && i.ips?.length >= 3) {
    const maxNodes = 18;
    const ips = i.ips.slice(0, maxNodes);
    const count = ips.length;
    const cx = 45, cy = 45, r = 32;
    const angle = (2 * Math.PI) / count;
    let links = '';
    let satellites = '';
    ips.forEach((ip, idx) => {
      const x = (cx + Math.cos(idx * angle) * r).toFixed(1);
      const y = (cy + Math.sin(idx * angle) * r).toFixed(1);
      links += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255, 71, 87, 0.45)" stroke-width="1.5" stroke-dasharray="2 2"/>`;
      satellites += `<circle cx="${x}" cy="${y}" r="3.5" fill="#ff4757"/>`;
    });
    const centerColor = controlled ? '#00ff87' : '#ff4757';
    const tagTxt = isEn ? 'Distributed Threat Network' : 'Dağıtık Tehdit Ağı';
    const mfaTxt = controlled ? (isEn ? '(MFA Enabled)' : '(MFA Etkin)') : (isEn ? '(No MFA)' : '(MFA Yok)');
    const attackerTxt = isEn ? `Attacker: <strong>${i.ips.length} distinct IP addresses</strong> (${ips.slice(0, 3).join(', ')}…)` : `Saldıran: <strong>${i.ips.length} farklı IP adresi</strong> (${ips.slice(0, 3).join(', ')}…)`;

    return `<div class="node-graph-box">
      <svg class="node-graph-svg" viewBox="0 0 90 90">
        ${links}
        <circle cx="${cx}" cy="${cy}" r="12" fill="var(--panel)" stroke="${centerColor}" stroke-width="2.5"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="${centerColor}"/>
        ${satellites}
      </svg>
      <div class="node-graph-details">
        <span class="node-graph-tag ${controlled ? 'tag-green' : 'tag-red'}">${tagTxt}</span>
        <div class="node-graph-text">
          ${isEn ? 'Target' : 'Merkez'}: <strong>${esc(i.user)}</strong> ${mfaTxt}<br>
          ${attackerTxt}
        </div>
      </div>
    </div>`;
  }
  if (i.type === 'spray' && i.users?.length >= 3) {
    const maxNodes = 18;
    const users = i.users.slice(0, maxNodes);
    const count = users.length;
    const cx = 45, cy = 45, r = 32;
    const angle = (2 * Math.PI) / count;
    let links = '';
    let satellites = '';
    users.forEach((uid, idx) => {
      const u = data?.users?.find(x => x.id === uid);
      const isMfa = u?.mfa === true;
      const x = (cx + Math.cos(idx * angle) * r).toFixed(1);
      const y = (cy + Math.sin(idx * angle) * r).toFixed(1);
      links += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(0, 229, 255, 0.4)" stroke-width="1.5" stroke-dasharray="2 2"/>`;
      satellites += `<circle cx="${x}" cy="${y}" r="3.5" fill="${isMfa ? '#00ff87' : '#ff4757'}"/>`;
    });
    const tagTxt = isEn ? 'Password Spray Network' : 'Password Spray Ağı';
    const sourceTxt = isEn ? `Source IP: <strong>${esc(i.ip)}</strong>` : `Merkez Kaynak: <strong>${esc(i.ip)}</strong>`;
    const targetTxt = isEn ? `Targets: <strong>${i.users.length} distinct accounts</strong>` : `Hedef: <strong>${i.users.length} farklı hesap</strong>`;

    return `<div class="node-graph-box">
      <svg class="node-graph-svg" viewBox="0 0 90 90">
        ${links}
        <circle cx="${cx}" cy="${cy}" r="12" fill="var(--panel)" stroke="#ff4757" stroke-width="2.5"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#ff4757"/>
        ${satellites}
      </svg>
      <div class="node-graph-details">
        <span class="node-graph-tag tag-red">${tagTxt}</span>
        <div class="node-graph-text">
          ${sourceTxt}<br>
          ${targetTxt}
        </div>
      </div>
    </div>`;
  }
  return '';
}

function incidents(limit){
  const isEn = getLang() === 'en';
  let rows = limit ? filteredIncidents().slice(0,limit) : filteredIncidents();
  const allRows = data?.incidents || [];
  const sprayCount = allRows.filter(i=>i.type==='spray').length;
  const distCount = allRows.filter(i=>i.type==='account').length;
  const travelCount = allRows.filter(i=>i.type==='travel').length;
  const ctrlCount = allRows.filter(i=>{
    const af = i.users.map(id=>data.users.find(u=>u.id===id)).filter(Boolean);
    return af.length && af.every(u=>u.mfa===true&&u.reviewState!=='critical');
  }).length;
  const attackFilters = !limit ? filterTabs('attacks', [
    [null, isEn ? 'All' : 'Tümü', allRows.length],
    ['spray', 'Password spray', sprayCount],
    ['distributed', isEn ? 'Distributed attack' : 'Dağıtık saldırı', distCount],
    ['travel', isEn ? 'Impossible travel' : 'İmkansız seyahat', travelCount],
    ['controlled', isEn ? 'Under Control' : 'Kontrol', ctrlCount],
    ['uncontrolled', isEn ? 'At Risk' : 'Risk', allRows.length-ctrlCount]
  ]) : '';

  const titleTxt = isEn ? 'Suspected Attacks' : 'Saldırı şüpheleri';
  const subTxt = isEn ? 'Attack + Travel anomalies' : 'Saldırı + Seyahat anomalileri';
  const remBtnTxt = isEn ? '⚡ Emergency Remediation' : '⚡ Acil Müdahale';
  const mfaProtPill = isEn ? '<span class="pill low">MFA Protected</span>' : '<span class="pill low">MFA Korumalı</span>';
  const noMfaPill = isEn ? '<span class="pill high">No MFA</span>' : '<span class="pill high">MFA Yok</span>';
  const emptyTxt = isEn ? 'No signals matching rules in selected period and filter.<br>This does not guarantee complete absence of threats in your environment.' : 'Seçilen dönemde ve filtrede kurala uyan sinyal yok.<br>Bu sonuç ortamda saldırı olmadığı anlamına gelmez.';

  return `<section class="panel"><div class="panel-head"><h2>${titleTxt}</h2><small>${subTxt}</small></div>${attackFilters}${rows.length ? `<div class="panel-body">${rows.map(i=>{
    const affected = i.users.map(id=>data.users.find(u=>u.id===id)).filter(Boolean);
    const controlled = affected.length && affected.every(u=>u.mfa===true&&u.reviewState!=='critical');
    const graphHtml = drawNodeGraph(i, controlled);
    const targetLabel = (i.type==='account'||i.type==='travel') ? esc(i.user) : esc(i.ip);
    const badgeLabel = controlled ? (isEn ? 'Under Control' : 'Kontrol') : i.type==='account' ? (isEn ? 'Distributed attack' : 'Dağıtık saldırı') : i.type==='travel' ? (isEn ? 'Impossible travel' : 'İmkansız seyahat') : 'Password spray';

    const metaTxt = i.type==='account' 
      ? (isEn ? `<strong>${i.ips.length} distinct IPs</strong> · ${i.attempts} lockouts/failed passwords · ${esc(i.apps.join(', ')||'No app info')}` : `<strong>${i.ips.length} farklı IP</strong> · ${i.attempts} kilitlenme/hatalı parola · ${esc(i.apps.join(', ')||'Uygulama bilgisi yok')}`)
      : i.type==='travel'
      ? (isEn ? `<strong>${i.countries.join(' ➔ ')}</strong> · 2 successful sign-ins within 1 hour` : `<strong>${i.countries.join(' ➔ ')}</strong> · 1 saatte 2 başarılı giriş`)
      : (isEn ? `<strong>${i.users.length} target accounts</strong> · ${i.attempts} failed passwords · ${esc(i.apps.join(', ')||'No app info')}` : `<strong>${i.users.length} hedef hesap</strong> · ${i.attempts} hatalı parola · ${esc(i.apps.join(', ')||'Uygulama bilgisi yok')}`);

    const mfaStatusTxt = controlled 
      ? (isEn ? ' · <span class="green">MFA enabled, password compromise prevented</span>' : ' · <span class="green">MFA etkin, parola aşımı engellendi</span>')
      : (isEn ? ' · <span class="red">No MFA protection</span>' : ' · <span class="red">MFA koruması bulunmuyor</span>');

    return `<div class="row incident-row" ${(i.type==='account'||i.type==='travel')?`data-user="${esc(i.userId)}"`:''}>
      <div class="incident-top">
        <div class="incident-identity">
          <strong class="incident-name">${targetLabel}</strong>
          <span class="pill ${controlled?'mid':'high'}">${badgeLabel}</span>
          ${controlled ? mfaProtPill : noMfaPill}
        </div>
        <div class="incident-time">${date(i.start)} – ${date(i.time)}</div>
        ${isRemediationEnabled() ? `<button type="button" class="btn btn-incident-action remediation-incident-btn" data-incident-idx="${allRows.indexOf(i)}">${remBtnTxt}</button>` : ''}
      </div>
      <p class="incident-meta">
        ${metaTxt}${mfaStatusTxt}
      </p>
      ${graphHtml}
    </div>`;
  }).join('')}</div>` : `<div class="empty">${emptyTxt}</div>`}</section>`;
}

function rules(){
  const isEn = getLang() === 'en';
  const rulesList = isEn ? [
    ['+45','Same IP targeted ≥ 5 accounts in 10 minutes'],
    ['+50','A single account targeted from ≥ 5 distinct IPs in 30 minutes'],
    ['+10–25','Volume of failed passwords / account lockouts'],
    ['+10–30','Number of distinct IPs in attack failures'],
    ['+15','At least 5 account lockout (50053) events'],
    ['100','Suspicious success: successful sign-in from same IP after failed attempts'],
    ['Control','Attack signal present and MFA enabled; no suspicious success'],
    ['Excluded','Safe IP/CIDR addresses configured in settings']
  ] : [
    ['+45','Aynı IP, 10 dakikada ≥ 5 hesabı hedefledi'],
    ['+50','Bir hesap, 30 dakikada ≥ 5 farklı IP’den hedeflendi'],
    ['+10–25','Hatalı parola / hesap kilitlenmesi hacmi'],
    ['+10–30','Saldırı hatalarındaki farklı IP sayısı'],
    ['+15','En az 5 hesap kilitli (50053) olayı'],
    ['100','Şüpheli başarısız denemelerden sonra aynı IP ile başarılı oturum'],
    ['Kontrol','Saldırı sinyali var ve MFA etkin; şüpheli başarı yok'],
    ['Hariç','Ayarlardaki güvenli IP/CIDR adresleri']
  ];

  const titleTxt = isEn ? 'How is Priority Calculated?' : 'Öncelik nasıl hesaplanır?';
  const hintTxt = isEn ? 'Enabled MFA is a strong control indicating the password was not compromised; it does not declare the incident completely safe. Make the final decision via incident review.' : 'MFA etkinliği parolanın aşılmadığına dair güçlü bir kontroldür; olayı tamamen güvenli ilan etmez. Son kararı olay incelemesiyle verin.';

  return `<section class="panel"><div class="panel-head"><h2>${titleTxt}</h2></div><div class="panel-body">${rulesList.map(([p,t])=>`<div class="rule"><b>${p}</b>${t}</div>`).join('')}<p class="hint">${hintTxt}</p></div></section>`;
}

function auditMode(){return state.config?.mode==='m365';}
function freeMode(){return state.config?.mode==='free';}
function auditPanel(){
  if(!auditMode())return '';
  const isEn = getLang() === 'en';
  const job=state.apiSetup||{};
  const titleTxt = isEn ? 'Microsoft 365 Audit API' : 'Microsoft 365 Audit API';
  const tagTxt = isEn ? 'AUTOMATIC CONNECTION' : 'OTOMATİK BAĞLANTI';
  const descTxt = isEn ? 'Sign in with your Microsoft admin account. App registration, Audit, and MFA method reading permissions will be prepared automatically.' : 'Microsoft yönetici hesabınızla giriş yapın. Uygulama kaydı, Audit ve MFA yöntemi okuma izinleri otomatik hazırlanır.';
  const hintTxt = isEn ? 'Required read-only permissions: User.Read.All, UserAuthenticationMethod.Read.All, and ActivityFeed.Read. Run this button once more to add new MFA permissions.' : 'Gerekli salt okunur izinler: User.Read.All, UserAuthenticationMethod.Read.All ve ActivityFeed.Read. Yeni MFA iznini eklemek için bu düğmeyi bir kez daha çalıştırın.';
  const cliHelp = isEn ? '<br><br><a href="https://learn.microsoft.com/cli/azure/install-azure-cli-windows" target="_blank" class="link-underlined">Download Azure CLI Setup ↗</a> &nbsp;·&nbsp; <a href="#" onclick="document.querySelector(\'[data-mode=manual]\').click();return false;" class="link-underlined">Continue with manual setup</a>' : '<br><br><a href="https://learn.microsoft.com/cli/azure/install-azure-cli-windows" target="_blank" class="link-underlined">Azure CLI Kurulumunu İndir ↗</a> &nbsp;·&nbsp; <a href="#" onclick="document.querySelector(\'[data-mode=manual]\').click();return false;" class="link-underlined">Manuel kurulum ile devam et</a>';
  const connectBtnTxt = job.active ? (isEn ? 'Microsoft login / API setup in progress…' : 'Microsoft girişi / API kurulumu sürüyor…') : (isEn ? 'Connect / Update API permissions →' : 'API izinlerini bağla / güncelle →');
  const bottomHint = isEn ? 'P1/P2 not required; Audit Standard and active Purview auditing required. Initial Audit packages may take up to 12 hours to arrive.' : 'P1/P2 gerekmez; Audit Standard ve etkin Purview denetimi gerekir. İlk Audit paketlerinin oluşması 12 saate kadar sürebilir.';

  return `<section class="panel"><div class="panel-head"><h2>${titleTxt}</h2><span class="tag">${tagTxt}</span></div><div class="panel-body"><p>${descTxt}</p><p class="hint">${hintTxt}</p>${job.message?`<div class="banner" role="status">${esc(job.message)}</div>`:''}${job.error?`<div class="banner error" role="alert">${esc(job.error)}${job.error.includes('Azure CLI')?cliHelp:''}</div>`:''}<button class="btn primary wide" id="connect-api" ${job.active||state.sync?.busy?'disabled':''}>${connectBtnTxt}</button><p class="hint">${bottomHint}</p>${state.sync?.auditMessage?`<div class="banner">${esc(state.sync.auditMessage)}</div>`:''}</div></section>`;
}
function connectionReady(){if(auditMode())return state.sync?.mode==='m365'&&!!state.sync?.auditLastSuccess&&!state.sync?.auditWaiting;return freeMode()?state.connection?.directoryVerified:state.connection?.verified;}
function connectionLabel(){
  const isEn = getLang() === 'en';
  if(auditMode()) return connectionReady() ? (isEn ? 'M365 AUDIT CONNECTED' : 'M365 AUDIT BAĞLI') : (isEn ? 'M365 AUDIT · AWAITING CONSENT / DATA' : 'M365 AUDIT · ONAY / VERİ BEKLİYOR');
  return connectionReady() ? (freeMode() ? (isEn ? 'DIRECTORY CONNECTED · LOGS FROM FILE' : 'DİZİN BAĞLI · LOG DOSYADAN') : (isEn ? 'ENTRA CONNECTED' : 'ENTRA BAĞLI')) : state.connection ? (isEn ? 'AWAITING CONSENT / VERIFICATION' : 'ONAY / DOĞRULAMA BEKLİYOR') : (isEn ? 'NO CONNECTION' : 'BAĞLANTI YOK');
}
function modePanel(){
  const isEn = getLang() === 'en';
  const current=state.config?.mode||'m365';
  const guide=(mode,title,badge,summary,body)=>`<details class="mode-guide ${current===mode?'selected':''}" ${current===mode?'open':''}><summary><span><strong>${title}</strong><small>${summary}</small></span><span class="tag ${current===mode?'':'pending'}">${current===mode?(isEn ? 'ACTIVE' : 'AKTİF'):badge}</span></summary><div class="mode-guide-body">${body}<button class="btn ${current===mode?'':'primary'}" data-license-mode="${mode}" ${current===mode?'disabled':''}>${current===mode?(isEn ? 'Mode currently active' : 'Bu mod kullanılıyor'):(isEn ? 'Use this mode →' : 'Bu modu kullan →')}</button></div></details>`;
  
  const titleTxt = isEn ? 'Data Source and License Mode' : 'Veri kaynağı ve lisans modu';
  const subTxt = isEn ? 'Expand a mode to see scope, permissions, and setup steps.' : 'Bir modu açarak kapsamını, izinlerini ve kurulum adımlarını görün.';

  const freeTitle = isEn ? 'File Mode' : 'Dosya modu';
  const freeBadge = isEn ? 'NO P1/P2 REQUIRED' : 'P1/P2 GEREKMEZ';
  const freeSummary = isEn ? 'User directory automatic, sign-in logs from portal JSON file.' : 'Kullanıcı dizini otomatik, giriş logları portal JSON dosyasından.';
  const freeBody = isEn ? `<div class="guide-grid"><div><h3>What does it collect?</h3><ul class="checklist"><li>User directory and account status via Graph</li><li>Interactive / non-interactive sign-in JSON logs imported from Entra portal</li><li>MFA registration status is not collected; shown as "unknown"</li></ul></div><div><h3>Required Permissions</h3><ul class="checklist"><li><strong>Microsoft Graph · User.Read.All</strong> · Application</li><li>At least <strong>Reports Reader</strong> role for portal downloads</li><li>No Graph sign-in log API permissions or P1/P2 required</li></ul></div></div><details class="field-help"><summary>File mode setup guide</summary><ol class="checklist"><li>Add User.Read.All to your tenant app registration and grant admin consent.</li><li>Verify connection in IDSignal and fetch users.</li><li>In Entra → Monitoring &amp; health → Sign-in logs, select date range.</li><li>Click Download → JSON to get complete sign-in file, then import below.</li></ol></details>`
    : `<div class="guide-grid"><div><h3>Ne toplar?</h3><ul class="checklist"><li>Graph üzerinden kullanıcı dizini ve hesap durumu</li><li>Entra portalından aktarılan interaktif/non-interaktif giriş JSON kayıtları</li><li>MFA kayıt durumu alınmaz; “bilinmiyor” gösterilir</li></ul></div><div><h3>Gerekli izinler</h3><ul class="checklist"><li><strong>Microsoft Graph · User.Read.All</strong> · Application</li><li>Portal indirmesi için kullanıcıda en az <strong>Reports Reader</strong> rolü</li><li>Graph giriş logu API izni veya P1/P2 gerekmez</li></ul></div></div><details class="field-help"><summary>Dosya modu kurulum rehberi</summary><ol class="checklist"><li>Tenant uygulamasına User.Read.All ekleyip yönetici onayı verin.</li><li>IDSignal’da bağlantıyı doğrulayıp kullanıcıları çekin.</li><li>Entra → Monitoring &amp; health → Sign-in logs ekranında tarih aralığını seçin.</li><li>Download → JSON ile tam giriş dosyasını indirip aşağıdaki aktarım alanına yükleyin.</li></ol></details>`;

  const premTitle = isEn ? 'P1/P2 · Graph Mode' : 'P1/P2 · Graph modu';
  const premBadge = isEn ? 'P1/P2 REQUIRED' : 'P1/P2 GEREKLİ';
  const premSummary = isEn ? 'Sign-in logs, user directory, and MFA report directly from Microsoft Graph.' : 'Giriş günlükleri, kullanıcı dizini ve MFA raporu Microsoft Graph’tan.';
  const premBody = isEn ? `<div class="guide-grid"><div><h3>What does it collect?</h3><ul class="checklist"><li>Graph user directory</li><li>Graph signIns logs</li><li>Authentication Methods registration report</li></ul></div><div><h3>Required Permissions</h3><ul class="checklist"><li><strong>User.Read.All</strong> · Application</li><li><strong>AuditLog.Read.All</strong> · Application</li><li>Tenant admin consent for all permissions</li><li>Entra ID P1/P2 license for sign-in report access</li></ul></div></div><details class="field-help"><summary>P1/P2 Graph mode setup guide</summary><ol class="checklist"><li>Open Microsoft Graph Application permissions in app registration.</li><li>Add User.Read.All and AuditLog.Read.All permissions.</li><li>Grant admin consent.</li><li>Select this mode and use "Verify Connection &amp; Fetch Logs".</li></ol></details>`
    : `<div class="guide-grid"><div><h3>Ne toplar?</h3><ul class="checklist"><li>Graph kullanıcı dizini</li><li>Graph signIns giriş günlükleri</li><li>Authentication Methods registration raporu</li></ul></div><div><h3>Gerekli izinler</h3><ul class="checklist"><li><strong>User.Read.All</strong> · Application</li><li><strong>AuditLog.Read.All</strong> · Application</li><li>Tüm izinler için tenant yönetici onayı</li><li>Sign-in rapor erişimi için Entra ID P1/P2 kapsamı</li></ul></div></div><details class="field-help"><summary>P1/P2 Graph modu kurulum rehberi</summary><ol class="checklist"><li>Uygulama kaydında Microsoft Graph Application permissions bölümünü açın.</li><li>User.Read.All ve AuditLog.Read.All izinlerini ekleyin.</li><li>Grant admin consent ile yönetici onayı verin.</li><li>Bu modu seçip “Bağlantıyı doğrula ve logları çek” düğmesini kullanın.</li></ol></details>`;

  const m365Title = isEn ? 'Microsoft 365 Audit API' : 'Microsoft 365 Audit API';
  const m365Badge = isEn ? 'NO P1/P2 REQUIRED' : 'P1/P2 GEREKMEZ';
  const m365Summary = isEn ? 'Audit Standard events and MFA methods automatically via API.' : 'Audit Standard olayları ve MFA yöntemleri otomatik API ile.';
  const m365Body = isEn ? `<div class="guide-grid"><div><h3>What does it collect?</h3><ul class="checklist"><li>M365 Management Activity API sign-in/lockout events</li><li>Graph user directory</li><li>MFA registration status via Graph authentication methods</li></ul></div><div><h3>Required Permissions</h3><ul class="checklist"><li><strong>Graph · User.Read.All</strong> · Application</li><li><strong>Graph · UserAuthenticationMethod.Read.All</strong> · Application</li><li><strong>Office 365 Management APIs · ActivityFeed.Read</strong> · Application</li><li>Audit Standard and tenant admin consent</li></ul></div></div><details class="field-help"><summary>Microsoft 365 Audit API setup guide</summary><ol class="checklist"><li>Select this mode and click "Connect / Update API Permissions".</li><li>Sign in with an authorized admin account in the Microsoft window.</li><li>IDSignal prepares app registration and 3 read-only permissions automatically.</li><li>Initial Audit subscription packages may take up to 12 hours. MFA methods refresh daily.</li></ol><p class="hint">If MFA method reading hits rate limits, pending users are retried in controlled batches.</p></details>`
    : `<div class="guide-grid"><div><h3>Ne toplar?</h3><ul class="checklist"><li>M365 Management Activity API giriş/kilitlenme olayları</li><li>Graph kullanıcı dizini</li><li>Graph kullanıcı authentication methods üzerinden MFA kayıt durumu</li></ul></div><div><h3>Gerekli izinler</h3><ul class="checklist"><li><strong>Graph · User.Read.All</strong> · Application</li><li><strong>Graph · UserAuthenticationMethod.Read.All</strong> · Application</li><li><strong>Office 365 Management APIs · ActivityFeed.Read</strong> · Application</li><li>Audit Standard ve tenant yönetici onayı</li></ul></div></div><details class="field-help"><summary>Microsoft 365 Audit API kurulum rehberi</summary><ol class="checklist"><li>Bu modu seçin ve “API izinlerini bağla / güncelle” düğmesine basın.</li><li>Açılan Microsoft ekranında yetkili yönetici hesabıyla giriş yapın.</li><li>IDSignal uygulama kaydını ve üç salt okunur izni otomatik hazırlar.</li><li>İlk Audit aboneliğinde paketler 12 saate kadar gecikebilir. MFA yöntemleri günlük yenilenir.</li></ol><p class="hint">MFA yöntemi okuması istek sınırına takılırsa yalnızca bekleyen kullanıcılar kontrollü olarak yeniden denenir.</p></details>`;

  return `<section class="panel"><div class="panel-head"><div><h2>${titleTxt}</h2><small>${subTxt}</small></div></div><div class="panel-body mode-guides">${guide('free',freeTitle,freeBadge,freeSummary,freeBody)}${guide('premium',premTitle,premBadge,premSummary,premBody)}${guide('m365',m365Title,m365Badge,m365Summary,m365Body)}</div></section>`;
}

function portalPanel(){
  const isEn = getLang() === 'en';
  if(!freeMode()||auditMode())return '';
  const p=state.portal||{},ready=p.active&&!p.running,disabled=!p.available||!state.connection||state.sync?.busy||p.running;
  return '<section class="panel portal-panel"><div class="panel-head"><h2>'+(isEn ? 'Fetch last 7 days from portal' : 'Portaldan son 7 günü al')+'</h2><span class="tag">'+esc(p.browserLabel||(isEn ? 'Browser' : 'Tarayıcı'))+(isEn ? ' · ASSISTED AUTOMATION' : ' · YARDIMLI OTOMASYON')+'</span></div><div class="panel-body"><p>'+(isEn ? 'A separate automation browser window opens. Keep the "IDSignal · Automation Session" tab open; complete sign-in and MFA in the adjacent tab. An Entra tab in another browser window or Codex is not connected to this session; automation captures the 7-day JSON output from the portal and transfers it to the panel. No file selection required.' : 'Ayrı bir otomasyon tarayıcısı penceresi açılır. “IDSignal · Otomasyon oturumu” sekmesini açık bırakın; yanındaki sekmede giriş ve MFA’yı tamamlayın. Başka bir tarayıcı penceresindeki veya Codex içindeki Entra sekmesi bu oturuma bağlı değildir; otomasyon portalın son 7 günlük JSON çıktısını yakalayıp panele aktarır. Dosya seçmeniz gerekmez.')+'</p><p class="hint">'+(isEn ? 'Selected user sign-in category and additional filters in the portal apply. This process does not provide P1/P2 API access; it works with your portal permissions. The session is separate for this operation and is closed upon completion.' : 'Portalda seçili kullanıcı giriş kategorisi ve ek filtreler geçerlidir. Bu işlem P1/P2 API erişimi sağlamaz; portal yetkinizle çalışır. Oturum bu işlem için ayrıdır ve tamamlanınca kapatılır.')+'</p>'+
  (!p.available?'<div class="banner warn">'+esc(p.reason||(isEn ? 'Checking browser infrastructure.' : 'Tarayıcı altyapısı kontrol ediliyor.'))+'</div>':'')+
  (p.phase&&p.phase!=='idle'?'<div class="banner '+(['needs_attention','error','browser_closed'].includes(p.phase)?'warn':'')+'" role="status">'+esc(p.message)+'</div>':'')+
  (p.diagnostic?'<details class="field-help"><summary>'+(isEn ? 'Browser closure diagnostics' : 'Tarayıcı kapanma tanısı')+'</summary><p class="hint">'+(isEn ? 'App requested closure: ' : 'Uygulama kapanış istedi: ')+(p.diagnostic.applicationRequestedClose?(isEn ? 'Yes' : 'Evet'):(isEn ? 'No' : 'Hayır'))+'</p><ul class="hint">'+(p.diagnostic.events||[]).map(e=>'<li>'+esc(e.time)+' · '+esc(e.event)+'</li>').join('')+'</ul><p class="hint">'+(isEn ? 'This log contains window events only; no passwords, cookies, or session URLs.' : 'Bu kayıt yalnızca pencere olaylarını içerir; parola, çerez veya oturum adresi içermez.')+'</p></details>':'')+
  (!p.active?'<button class="btn primary" id="portal-start" '+(disabled?'disabled':'')+'>'+(isEn ? '↗ Fetch last 7 days from portal' : '↗ Portaldan son 7 günü al')+'</button>':'')+
  (ready?'<label class="confirm-import"><input id="portal-tenant-confirm" type="checkbox"> '+(isEn ? 'I signed in on the automation browser; I confirm that the selected organization is the tenant below and no extra user/app filters are set on the sign-in logs screen.' : 'Otomasyon tarayıcısında giriş yaptım; seçili kuruluşun aşağıdaki tenant olduğunu ve giriş logları ekranında ek kullanıcı/uygulama filtresi bulunmadığını doğruluyorum.')+'</label><div class="code">'+esc(state.connection?.tenantId)+'</div><div class="form-actions"><button class="btn primary" id="portal-continue">'+(isEn ? 'Signed in, continue →' : 'Giriş yaptım, devam et →')+'</button>'+(p.phase==='needs_attention'?'<button class="btn" id="portal-listen">'+(isEn ? 'Listen to portal download' : 'Portal indirmesini dinle')+'</button>':'')+'</div>':'')+
  (p.active?'<button class="btn spacer" id="portal-cancel">'+(isEn ? 'Cancel and close automation session' : 'İptal et ve otomasyon oturumunu kapat')+'</button>':'')+
  '<p class="hint">'+(isEn ? 'If the portal layout is unrecognized, execution stops and guidance is shown. Automatic transfer is not performed without verifying the 7-day filter. MFA registration status remains unknown in this flow.' : 'Portal görünümü tanınmazsa işlem durur ve yönlendirme gösterilir. Son 7 gün filtresi doğrulanmadan otomatik aktarım yapılmaz. MFA kayıt bilgisi bu akışta da bilinmiyor kalır.')+'</p></div></section>';
}

function importPanel(){if(!freeMode()||auditMode())return '';const isEn=getLang()==='en';return '<section class="panel"><div class="panel-head"><h2>'+(isEn?'Import sign-in logs from JSON file':'Giriş loglarını JSON dosyasından aktar')+'</h2><span class="tag">'+(isEn?'NO P1/P2 REQUIRED':'P1/P2 GEREKMEZ')+'</span></div><div class="panel-body"><ol class="checklist"><li><a href="https://entra.microsoft.com/" target="_blank" rel="noreferrer">'+(isEn?'Open Entra portal ↗':'Entra portalını açın ↗')+'</a>; <strong>Entra ID → Monitoring &amp; health → Sign-in logs</strong> '+(isEn?'section.':'bölümüne gidin.')+'</li><li>'+(isEn?'Select date range. Entra Free retains the last <strong>7 days</strong>.':'Tarih aralığını seçin. Entra Free, son <strong>7 günü</strong> saklar.')+'</li><li><strong>Download → JSON</strong> '+(isEn?'to download complete user sign-in file. Do not select "authentication details only". Interactive and non-interactive user logs can be imported separately.':'ile kullanıcı girişlerinin tam dosyasını indirin. “Yalnızca authentication details” dosyasını seçmeyin. İnteraktif ve non-interaktif kullanıcı loglarını ayrı ayrı aktarabilirsiniz.')+'</li><li>'+(isEn?'Select JSON file below and import. CSV import is not supported in this version.':'Aşağıdan JSON dosyasını seçip içeri aktarın. Bu sürümde CSV içeri aktarma desteklenmez.')+'</li></ol><p class="hint">'+(isEn?'At least Reports Reader role required. Logs represent only the date and filter scope in the file; not auto-refreshed. MFA registration info cannot be extracted from this file.':'En az Reports Reader rolü gerekir. Loglar yalnızca dosyadaki tarih ve filtre kapsamını temsil eder; otomatik yenilenmez. MFA kayıt bilgisi bu dosyadan çıkarılamaz.')+'</p>'+(state.connection?'<form id="import-form"><label for="signins-file">'+(isEn?'Sign-in logs · JSON (max 20 MB)':'Sign-in logs · JSON (en fazla 20 MB)')+'</label><input type="file" id="signins-file" accept=".json,application/json" required><label class="confirm-import"><input id="confirm-import" type="checkbox" required> '+(isEn?'I confirm this file belongs to the tenant below.':'Bu dosyanın aşağıdaki tenant’a ait olduğunu doğruluyorum.')+'</label><div class="code">'+esc(state.connection.tenantId)+'</div><p class="hint">'+(isEn?'Exported file may not contain tenant ID; target tenant is matched with your selection.':'Dışa aktarılan dosya tenant kimliği içermeyebilir; hedef tenant sizin seçiminizle eşleştirilir.')+'</p><button class="btn primary wide" '+(state.sync?.busy?'disabled':'')+'>'+(isEn?'Import JSON logs':'JSON loglarını içeri aktar')+'</button></form>':'<p>'+(isEn?'Save your tenant and application info in the connection form below first.':'Önce aşağıdaki bağlantı formuna tenant ve uygulama bilgilerinizi kaydedin.')+'</p>')+(state.import?'<p class="hint">'+(isEn?`Last import: ${date(state.import.lastImport)} · ${fmt(state.import.inserted)} new records · ${fmt(state.import.existing+state.import.duplicates)} duplicates · ${fmt(state.import.expired)} records outside 30-day retention.`:`Son aktarım: ${date(state.import.lastImport)} · ${fmt(state.import.inserted)} yeni kayıt · ${fmt(state.import.existing+state.import.duplicates)} tekrar · ${fmt(state.import.expired)} kayıt 30 günlük saklama aralığı dışında.`)+'</p>':'')+'</div></section>';}

function sources(){const isEn=getLang()==='en';const c=state.connection;if(auditMode())return `<div class="heading"><div><div class="eyebrow">${isEn?'Entra connection':'Entra bağlantısı'}</div><h1>${isEn?'Connect Microsoft 365':'Microsoft 365’i bağlayın'}</h1><p>${isEn?'Sign in; IDSignal will prepare the API registration and permissions.':'Giriş yapın; API kaydını ve izinlerini IDSignal hazırlasın.'}</p></div></div>${modePanel()}${syncBanner()}${auditPanel()}<div class="two"><section class="panel"><div class="panel-body">${c?`<div class="connection-state"><span class="mark">▦</span><div><h2>${isEn?'Entra app registered':'Entra uygulaması kaydedildi'}</h2><small>Microsoft Graph · Application permissions</small></div></div><label>Tenant ID</label><div class="code">${esc(c.tenantId)}</div><label>Client ID</label><div class="code">${esc(c.clientId)}</div><div class="form-actions"><button class="btn primary" id="consent">${isEn?'Go to Entra & grant admin consent ↗':'Entra’ya git ve yönetici onayı ver ↗'}</button><button class="btn" id="sync" ${state.sync?.busy?'disabled':''}>${isEn?'Verify connection & fetch logs':'Bağlantıyı doğrula ve logları çek'}</button></div><button class="btn danger spacer" id="disconnect">${isEn?'Remove local connection & collected data':'Yerel bağlantıyı ve toplanan verileri kaldır'}</button>`:`<h2>${isEn?'Manual Setup (Fallback)':'Manuel Kurulum (Alternatif)'}</h2><p class="hint">${isEn?'If the automatic connection button above fails (e.g., running in Docker), please create an app registration manually and enter the details below.':'Yukarıdaki otomatik bağlantı düğmesi çalışmazsa (ör. Docker kullanıyorsanız), lütfen manuel olarak bir uygulama oluşturup bilgileri aşağıya girin.'}</p>${manualForm(false)}`}</div></section></div>`;return `<div class="heading"><div><div class="eyebrow">${isEn?'Setup · 02 / 03':'Kurulum · 02 / 03'}</div><h1>${isEn?'Connect Microsoft Entra':'Microsoft Entra’yı bağlayın'}</h1><p>${isEn?'App registration, admin consent, and initial data collection.':'Uygulama kaydı, yönetici onayı ve ilk veri toplama.'}</p></div><span class="tag ${connectionReady()?'':'pending'}">${connectionLabel()}</span></div>${modePanel()}${syncBanner()}${auditPanel()}${portalPanel()}${importPanel()}<div class="two"><section class="panel"><div class="panel-body">${c?`<div class="connection-state"><span class="mark">▦</span><div><h2>${isEn?'Entra app registered':'Entra uygulaması kaydedildi'}</h2><small>Microsoft Graph · Application permissions</small></div></div><label>Tenant ID</label><div class="code">${esc(c.tenantId)}</div><label>Client ID</label><div class="code">${esc(c.clientId)}</div><div class="form-actions"><button class="btn primary" id="consent">${isEn?'Go to Entra & grant admin consent ↗':'Entra’ya git ve yönetici onayı ver ↗'}</button><button class="btn" id="sync" ${state.sync?.busy?'disabled':''}>${freeMode()&&!auditMode()?(isEn?'Verify connection & fetch users':'Bağlantıyı doğrula ve kullanıcıları çek'):(isEn?'Verify connection & fetch logs':'Bağlantıyı doğrula ve logları çek')}</button></div><p class="hint">${isEn?`Returned here after consent to start initial sync. ${auditMode()?'Directory Graph, sign-in events synced via separate M365 Audit source.':freeMode()?'In Free mode, only user directory is verified; use JSON import for logs.':'Connection verified only when all three data sources are successfully read.'}`:`Onaydan sonra buraya dönülür ve ilk eşitleme başlar. ${auditMode()?'Dizin Graph, giriş olayları ayrı M365 Audit kaynağıyla eşitlenir.':freeMode()?'Ücretsiz modda yalnızca kullanıcı dizini doğrulanır; loglar için JSON aktarımı kullanın.':'Bağlantı ancak üç veri kaynağı başarıyla okunduğunda doğrulanır.'}`}</p>${c.updatedAt&&Date.now()-c.updatedAt>330*86400000?`<div class="banner warn banner-mt-16">${isEn?'⚠️ Client Secret is over 11 months old. Renew to avoid interruption.':'⚠️ Bağlantı sırrı (Client Secret) 11 aydan eski. Kesinti yaşamamak için yenileyin.'}</div>`:''}<details class="spacer"><summary>${isEn?'Renew Client Secret':'Client secret yenile'}</summary>${manualForm(true)}</details><button class="btn danger spacer" id="disconnect">${isEn?'Remove local connection & collected data':'Yerel bağlantıyı ve toplanan verileri kaldır'}</button><p class="hint">${isEn?'App and permissions in Entra remain untouched. Use Entra portal to revoke permissions.':'Entra’daki uygulama ve izinler yerinde kalır. İzinleri iptal etmek için Entra portalını kullanın.'}</p>`:`<div class="tabs"><button class="btn ${setupMode==='auto'?'selected':''}" data-mode="auto">${isEn?'Create new app':'Yeni uygulama oluştur'}</button><button class="btn ${setupMode==='manual'?'selected':''}" data-mode="manual">${isEn?'Connect existing app':'Mevcut uygulamayı bağla'}</button></div>${setupMode==='auto'?`<h2>${isEn?'Guided Setup':'Yönlendirmeli kurulum'}</h2><p>${isEn?'Enter your Tenant ID. A custom PowerShell script creates the app registration and client secret via your Microsoft login and transfers them to this local server.':'Tenant ID’nizi girin. Size özel PowerShell betiği, Microsoft oturumunuzla uygulama kaydını ve bağlantı sırrını oluşturup bu yerel sunucuya aktarır.'}</p><form id="bootstrap-form"><label for="tenant">Directory (Tenant) ID</label><input id="tenant" name="tenantId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" aria-describedby="tenant-help" required pattern="[0-9a-fA-F-]{36}">${tenantHelp()}<button class="btn primary wide">${isEn?'Download setup script ↓':'Kurulum betiğini indir ↓'}</button></form><ol class="checklist"><li><a href="https://learn.microsoft.com/cli/azure/install-azure-cli-windows" target="_blank" rel="noreferrer">Azure CLI</a> ${isEn?'must be installed.':'yüklü olmalı.'}</li><li>${isEn?'Inspect downloaded script and run with PowerShell.':'İndirdiğiniz betiği inceleyip PowerShell ile çalıştırın.'}</li><li>${isEn?'Sign in as a Microsoft admin.':'Microsoft yöneticisi olarak oturum açın.'}</li><li>${isEn?'Return here and click "Grant admin consent".':'Buraya dönüp “Yönetici onayı ver” düğmesine basın.'}</li></ol><p class="hint">${isEn?'Script is valid for 30 minutes and single-use. Creates an app registration and 1-year client secret. Requires no Azure resource/subscription setup outside your Microsoft 365 subscription.':'Betik 30 dakika geçerli ve tek kullanımlıktır. Bir uygulama kaydı ve 1 yıllık client secret oluşturur. Microsoft 365 aboneliğiniz dışında Azure kaynak/abonelik kurulumu gerektirmez.'}</p>`:manualForm(false)}`}</div></section><div><section class="panel"><div class="panel-head"><h2>${isEn?'Required read-only permissions':'Gereken salt okunur izinler'}</h2></div><div class="panel-body"><div class="row"><div><strong>AuditLog.Read.All</strong><p>${isEn?`Sign-in logs and MFA registration report${freeMode()?' · Not used in Free mode':''}`:`Giriş günlükleri ve MFA kayıt raporu${freeMode()?' · Ücretsiz modda kullanılmaz':''}`}</p></div><span class="pill">Application</span></div><div class="row"><div><strong>User.Read.All</strong><p>${isEn?'User directory and account status':'Kullanıcı dizini ve hesap durumu'}</p></div><span class="pill">Application</span></div><p class="hint">${isEn?`Microsoft Graph application permissions require authorized tenant admin consent. ${auditMode()?'User.Read.All required for directory; ActivityFeed.Read under Office 365 Management APIs required for Audit.':freeMode()?'User.Read.All is sufficient for automatic directory sync in Free mode. Other permissions on existing app are not automatically removed.':'Sign-in logs require Entra ID P1/P2 license and tenant report access.'}`:`Microsoft Graph uygulama izinleri için yetkili tenant yöneticisi onayı gerekir. ${auditMode()?'Dizin için User.Read.All; Audit için Office 365 Management APIs altında ActivityFeed.Read gerekir.':freeMode()?'Ücretsiz modda otomatik dizin eşitlemesi için User.Read.All yeterlidir. Mevcut uygulamadaki diğer izinler kendiliğinden kaldırılmaz.':'Giriş günlükleri için Entra ID P1/P2 lisansı ve tenant’ın rapor erişimi gerekir.'}`}</p></div></section><section class="panel"><div class="panel-head"><h2>${isEn?'Redirect URI for manual registration':'Manuel kayıt için yönlendirme adresi'}</h2></div><div class="panel-body"><p class="hint">${isEn?'Add exactly to Entra → App registrations → Authentication → Web:':'Entra → App registrations → Authentication → Web alanına tam olarak ekleyin:'}</p><div class="code">${esc(state.redirectUri)}</div><p class="hint">${isEn?'Use the Client Secret "Value"; Secret ID will not establish connection. Secret is not stored in frontend code or browser storage.':'Client secret’ın "Value" değerini kullanın; Secret ID bağlantı kurmaz. Sır frontend kodunda veya tarayıcı depolamasında saklanmaz.'}</p><a href="https://entra.microsoft.com/" target="_blank" rel="noreferrer">${isEn?'Open Microsoft Entra portal ↗':'Microsoft Entra portalını aç ↗'}</a></div></section></div></div>`;}
function tenantHelp(){const isEn=getLang()==='en';return `<div class="field-help" id="tenant-help"><p class="hint">${isEn?'Tenant ID is your Microsoft 365 organization identifier. Enter the 36-character ID instead of an email or domain.':'Tenant ID, Microsoft 365 kuruluşunuzun kimliğidir. E-posta adresi veya alan adı yerine 36 karakterlik kimliği girin.'}</p><details><summary>${isEn?'Where can I find Tenant ID?':'Tenant ID’yi nereden bulabilirim?'}</summary><ol class="checklist"><li><a href="https://entra.microsoft.com/" target="_blank" rel="noreferrer">${isEn?'Open Microsoft Entra portal ↗':'Microsoft Entra portalını açın ↗'}</a> ${isEn?'and sign in with your work account.':'ve iş hesabınızla oturum açın.'}</li><li>${isEn?'If you have multiple organizations, select the directory you want to connect.':'Birden fazla kuruluş varsa bağlamak istediğiniz dizini seçin.'}</li><li><strong>Entra ID → Overview ${isEn?'':'(Genel bakış)'} → Properties ${isEn?'':'(Özellikler)'}</strong> ${isEn?'section.':'bölümüne gidin.'}</li><li><strong>Tenant ID</strong> ${isEn?'value copy and paste into the field above.':'(Kiracı kimliği) değerini kopyalayıp yukarıdaki alana yapıştırın.'}</li></ol><p class="hint">${isEn?'If you cannot see this section, ask your IT admin for your organization Directory (Tenant) ID. Application (Client) ID and Subscription ID are different identifiers.':'Bu bölümü göremiyorsanız BT yöneticinizden kuruluşunuzun Directory (Tenant) ID bilgisini isteyin. Application (Client) ID ve Subscription ID farklı kimliklerdir.'}</p><a class="help-doc" href="https://learn.microsoft.com/en-us/entra/fundamentals/how-to-find-tenant" target="_blank" rel="noreferrer">${isEn?'Microsoft step-by-step guide ↗':'Microsoft’un adım adım rehberi ↗'}</a></details></div>`;}
function manualForm(update){const isEn=getLang()==='en';return `<form id="connection-form"><label for="tenant">Directory (Tenant) ID</label><input id="tenant" name="tenantId" value="${esc(state.connection?.tenantId||'')}" required pattern="[0-9a-fA-F-]{36}" ${update?'readonly':''} aria-describedby="tenant-help">${tenantHelp()}<label for="client">Application (Client) ID</label><input id="client" name="clientId" value="${esc(state.connection?.clientId||'')}" required pattern="[0-9a-fA-F-]{36}" aria-describedby="client-help"><p class="hint" id="client-help">${isEn?'Copy the <strong>Application (client) ID</strong> from Entra ID → App registrations → your app → Overview. Do not use Object ID.':'Entra ID → App registrations (Uygulama kayıtları) → uygulamanız → Overview (Genel bakış) bölümündeki <strong>Application (client) ID</strong> değerini kopyalayın. Object ID değerini kullanmayın.'}</p><label for="secret">Client secret · Value</label><input id="secret" name="secret" type="password" autocomplete="off" required maxlength="4096" aria-describedby="secret-help"><details class="field-help" id="secret-help"><summary>${isEn?'How to create a Client secret?':'Client secret nasıl oluşturulur?'}</summary><ol class="checklist"><li>${isEn?'In the same app, open <strong>Certificates &amp; secrets → Client secrets → New client secret</strong>.':'Aynı uygulamada <strong>Certificates &amp; secrets (Sertifikalar ve gizli diziler) → Client secrets → New client secret</strong> seçeneğini açın.'}</li><li>${isEn?'Set description and expiration, then click <strong>Add</strong>.':'Açıklama ve geçerlilik süresini belirleyip <strong>Add (Ekle)</strong> düğmesine basın.'}</li><li>${isEn?'Paste the generated <strong>Value</strong> into this field. Do not use <strong>Secret ID</strong>.':'Oluşan satırdaki <strong>Value (Değer)</strong> bilgisini bu alana yapıştırın. <strong>Secret ID</strong> bilgisini kullanmayın.'}</li></ol><p class="hint">${isEn?'Value is only shown upon creation. If you cannot see the old value, create a new secret; do not delete old secrets used by active connections.':'Value yalnızca oluşturulduğunda gösterilir. Eski değeri göremiyorsanız yeni bir secret oluşturun; çalışan bağlantılarda kullanılan eski secret’ı silmeyin.'}</p><a class="help-doc" href="https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials" target="_blank" rel="noreferrer">${isEn?'Microsoft credentials guide ↗':'Microsoft’un kimlik bilgileri rehberi ↗'}</a></details><button class="btn primary wide">${isEn?'Save credentials securely →':'Bilgileri güvenle kaydet →'}</button></form>`;}
function settings(){const isEn=getLang()==='en';return `<div class="heading"><div><div class="eyebrow">${isEn?'Workspace':'Çalışma alanı'}</div><h1>${isEn?'Settings':'Ayarlar'}</h1><p>${isEn?'Sync interval, safe networks, and data scope.':'Eşitleme sıklığı, güvenli ağlar ve veri kapsamı.'}</p></div></div><div class="two"><section class="panel"><div class="panel-head"><h2>${isEn?'Data collection and safe IPs':'Veri toplama ve güvenli IP’ler'}</h2></div><div class="panel-body"><form id="settings-form"><label for="interval">${isEn?'Automatic sync':'Otomatik eşitleme'}</label><select name="intervalMinutes" id="interval">${[[0,isEn?'Off':'Kapalı'],[15,isEn?'Every 15 minutes':'15 dakikada bir'],[30,isEn?'Every 30 minutes':'30 dakikada bir'],[60,isEn?'Every hour':'Saatte bir']].map(([v,l])=>`<option value="${v}" ${state.config.intervalMinutes===v?'selected':''}>${l}</option>`).join('')}</select><label for="initial">${isEn?'History on initial sync':'İlk eşitlemede geçmiş'}</label><select name="initialDays" id="initial">${[1,7,30].map(v=>`<option value="${v}" ${state.config.initialDays===v?'selected':''}>${isEn?`Last ${v} days`:`Son ${v} gün`}</option>`).join('')}</select><label for="safe-ips">${isEn?'Safe IP addresses and networks':'Güvenli IP adresleri ve ağlar'}</label><textarea id="safe-ips" name="safeIps" rows="7" placeholder="192.168.60.0/24&#10;203.0.113.25">${esc((state.config.safeIps||[]).join('\n'))}</textarea><p class="hint">${isEn?'Enter one IPv4, IPv6, or CIDR network per line. Events from these sources appear on the timeline but are excluded from spray, distributed attack, and risk scoring.':'Her satıra bir IPv4, IPv6 veya CIDR ağı girin. Bu kaynaklardan gelen olaylar zaman çizelgesinde görünür fakat spray, dağıtık saldırı ve risk skoruna katılmaz.'}</p><p class="hint">${isEn?'Historical window applies before the first successful sync. Subsequent syncs re-read the last 24 hours for late-arriving events.':'Geçmiş aralığı ilk başarılı eşitlemeden önce uygulanır. Sonraki eşitlemeler geç gelen olaylar için son 24 saati yeniden okur.'}</p><button class="btn primary">${isEn?'Save settings':'Ayarları kaydet'}</button></form></div></section><section class="panel"><div class="panel-head"><h2>${isEn?'Data and operational boundaries':'Veri ve çalışma sınırları'}</h2></div><div class="panel-body"><p>${isEn?`Events are retained for up to 30 days. User directory and MFA report are refreshed on every successful sync. ${auditMode()?'When server is running, scheduler syncs users and M365 Audit packages. Teams notifications are disabled.':freeMode()?'In Free mode, scheduler only refreshes user directory. Regularly update logs via portal automation or JSON import.':'Scheduled collection continues as long as server is running.'}`:`Olaylar en fazla 30 gün tutulur. Kullanıcı dizini ve MFA raporu her başarılı eşitlemede yenilenir. ${auditMode()?'Sunucu açıkken zamanlayıcı kullanıcıları ve M365 Audit paketlerini eşitler. Teams bildirimi yoktur.':freeMode()?'Ücretsiz modda zamanlayıcı yalnızca kullanıcı dizinini yeniler. Logları düzenli olarak portal otomasyonu veya JSON aktarımıyla güncelleyin.':'Sunucu çalıştığı sürece zamanlanmış toplama devam eder.'}`}</p><p class="hint">${isEn?'When country info is absent in Audit API, event IP is queried against ipwho.is service by server. Results are cached locally for 180 days; private network IPs are not sent to external services.':'Ülke bilgisi Audit API’de bulunmadığında olay IP’si sunucu tarafından ipwho.is servisine gönderilir. Sonuç 180 gün yerel önbellekte tutulur; özel ağ IP’leri dış servise gönderilmez.'}</p><p class="hint">${isEn?'This version supports single tenant and single local admin. Automated account lockout, MFA modification, and email notifications are not included.':'Bu sürüm tek tenant ve tek yerel yönetici içindir. Otomatik hesap engelleme, MFA değişikliği ve e-posta bildirimi içermez.'}</p><p class="hint">${isEn?'Connection secrets are encrypted with AES-256-GCM. Limit access to data folder and encryption keys via OS permissions.':'Bağlantı sırları AES-256-GCM ile şifrelenir. Veri klasörü ve şifreleme anahtarına erişimi işletim sistemi izinleriyle sınırlayın.'}</p></div></section><section class="panel"><div class="panel-head"><h2>${isEn?'Team Panel Access':'Ekip Paneli Erişimi'}</h2></div><div class="panel-body"><form id="viewer-form"><label for="viewer-pass">${isEn?'Read-only team password':'Salt okunur ekip parolası'}</label><input type="password" id="viewer-pass" name="password" required minlength="1" maxlength="128"><p class="hint">${isEn?'Share this password to grant team members view-only access to the dashboard (without edit permissions).':'Bu parolayı paylaşarak ekip üyelerinizin sadece izleyici olarak (değişiklik yapamadan) panoya erişmesini sağlayabilirsiniz.'}</p><button class="btn">${isEn?'Save password':'Parolayı kaydet'}</button></form></div></section></div>${rules()}`;}
function render(){if(!state.authenticated){$('#app').innerHTML=welcome();bind();return;}page=location.hash.slice(1).split('?')[0]||(!state.connection?'sources':'overview');if(!titles[page]||(state.readOnly&&['remediation','sources','settings'].includes(page)))page='overview';if(!location.hash)history.replaceState(null,'','#'+page);$('#app').innerHTML=shell();if(state.readOnly){$('#sync')?.remove();document.querySelectorAll('a[href="#sources"],a[href="#settings"],a[href="#remediation"]').forEach(a=>a.remove());const bottom=document.querySelector('.sidebar .bottom p');if(bottom)bottom.textContent='Ekip paylaşımı · Salt okunur';}bind();}
function download(text,name,type){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function csv(){const isEn=getLang()==='en';const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r\n]/,"'$&").replaceAll('"','""')+'"';const rows=[[isEn?'Name':'Ad',isEn?'Email':'E-posta','MFA',isEn?'Status':'Durum',isEn?'Failed':'Başarısız',isEn?'Password Fails':'Hatalı parola',isEn?'Score':'Skor'],...filteredUsers().map(u=>[u.name,u.email,u.mfa===null?(isEn?'Unknown':'Bilinmiyor'):u.mfa?(isEn?'Enabled':'Etkin'):(isEn?'None':'Yok'),u.reviewState,u.fails,u.passwordFails,u.score])];download('\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'idsignal.csv','text/csv;charset=utf-8');}
function csvMfaRec(){const isEn=getLang()==='en';const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r\n]/,"'$&").replaceAll('"','""')+'"';const rows=[[isEn?'Name':'Ad',isEn?'Email':'E-posta',isEn?'Risk Score':'Risk Skoru',isEn?'Source IP Count':'Kaynak IP Sayısı',isEn?'Password Fails':'Hatalı Parola',isEn?'Threat Indicator':'Tehdit Göstergesi',isEn?'Recommendation Level':'Öneri Düzeyi'],...filteredRecommendations().map(u=>{const rl=recLevel(u);return [u.name,u.email,u.score,u.ips||0,u.passwordFails,recThreat(u),rl[0]];})];download('\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'mfa-oneri-listesi.csv','text/csv;charset=utf-8');}
function exportCaJson(){const isEn=getLang()==='en';const users=filteredRecommendations();if(!users.length)return notify(isEn?'No users found to generate policies.':'Kural üretilecek kullanıcı bulunamadı.',true);const ids=users.map(u=>u.id);const policy={displayName:`IDSignal: ${isEn?'Require MFA':'MFA Zorunlu'} (${date(Date.now())})`,state:"reportOnly",conditions:{users:{includeUsers:ids},applications:{includeApplications:["All"]},clientAppTypes:["all"]},grantControls:{operator:"OR",builtInControls:["mfa"]}};download(JSON.stringify(policy,null,2),'ConditionalAccessPolicy.json','application/json;charset=utf-8');notify(isEn?'Policy template downloaded. You can import it in Entra ID.':'Kural şablonu indirildi. Entra ID üzerinden Import edebilirsiniz.');}
async function resolveTimelineGeo(){const isEn=getLang()==='en';const nodes=[...document.querySelectorAll('[data-geo-ip]')],ips=[...new Set(nodes.map(n=>n.dataset.geoIp))];for(const ip of ips){try{const g=await api('geo?ip='+encodeURIComponent(ip)),label=g.countryOrRegion?[g.city,g.countryOrRegion].filter(Boolean).join(', '):(isEn?'Country unresolved':'Ülke çözümlenemedi');for(const n of nodes.filter(x=>x.dataset.geoIp===ip))n.textContent=label;}catch{for(const n of nodes.filter(x=>x.dataset.geoIp===ip))n.textContent=isEn?'Country unresolved':'Ülke çözümlenemedi';}}}
async function copyToClipboard(btn) {
  const isEn = getLang() === 'en';
  const text = btn.dataset.copy;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = isEn ? '✅ Copied!' : '✅ Kopyalandı!';
    btn.classList.add('copied');
    notify(isEn ? 'PowerShell command copied to clipboard.' : 'PowerShell komutu panoya kopyalandı.');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 2000);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    notify(isEn ? 'PowerShell command copied to clipboard.' : 'PowerShell komutu panoya kopyalandı.');
  }
}

function bindRemediationEvents() {
  // Handled via global event delegation
}

function showIncidentRemediation(idx) {
  const isEn = getLang() === 'en';
  const inc = (data?.incidents || [])[idx];
  if (!inc) return;

  if (inc.type === 'account' && inc.userId) {
    showRemediation(inc.userId);
    return;
  }
  if (inc.type === 'travel' && (inc.userId || inc.users?.[0])) {
    showRemediation(inc.userId || inc.users[0]);
    return;
  }

  // Password Spray or Multi-User Incident
  const targetUsers = (inc.users || []).map(uid => data?.users?.find(u => u.id === uid)).filter(Boolean);
  const targetEmails = targetUsers.map(u => u.email).filter(Boolean);
  const userCount = targetEmails.length;

  const sprayUserList = targetEmails.map(m => `  "${m}"`).join(',\n');
  const sprayUsersCode = `$TargetUsers = @(\n${sprayUserList}\n)`;

  const revokeCmd = `$TargetUsers | ForEach-Object { Revoke-MgUserSignInSession -UserId $_ }`;
  const resetCmd = `$TargetUsers | ForEach-Object { Update-MgUser -UserId $_ -PasswordProfile @{ ForceChangePasswordNextSignIn = $true } }`;

  let ipBlockStep = '';
  if (inc.ip || (inc.ips && inc.ips.length)) {
    const rawIps = inc.ip ? [inc.ip] : (inc.ips || []);
    const ipList = rawIps.map(ip => `  "${ip}"`).join(',\n');
    const ipCode = `$BlockedIPs = @(\n${ipList}\n)`;
    ipBlockStep = `
    <div class="remediation-card">
      <div class="remediation-card-header">
        <div class="remediation-step-badge">3</div>
        <div>
          <strong>${isEn ? `Block Attacker IP Address (${rawIps.length} Unique IPs)` : `Saldırgan IP Adresini Blokla (${rawIps.length} Farklı IP)`}</strong>
          <p class="remediation-desc">${isEn ? 'PowerShell array ready to add source IP addresses executing password spray attack to Firewall, WAF, or Entra ID Named Location block rule.' : 'Parola püskürtme (spray) saldırısını gerçekleştiren kaynak IP adresini Firewall, WAF veya Entra ID Named Location engelleme kuralına eklemek için hazır dizi.'}</p>
        </div>
      </div>
      <div class="remediation-code-box">
        <code>${esc(ipCode)}</code>
        <button type="button" class="btn copy-btn" data-copy="${esc(ipCode)}">${isEn ? '📋 Copy' : '📋 Kopyala'}</button>
      </div>
    </div>`;
  }

  const html = `
    <div class="remediation-header">
      <div>
        <div class="eyebrow eyebrow-accent">${isEn ? 'Incident Response (ITDR)' : 'Olay Müdahalesi (Incident Response)'}</div>
        <h2>${isEn ? '⚡ Password Spray Multi-User Remediation Plan' : '⚡ Password Spray Çoklu Müdahale Planı'}</h2>
        <p class="subtle subtle-zero-margin">${isEn ? `Attack Type: <strong>Password Spray</strong> · Targeted: <strong>${userCount} Accounts</strong> · Source IP: <strong>${esc(inc.ip || 'Unknown')}</strong>` : `Saldırı Türü: <strong>Password Spray</strong> · Hedeflenen: <strong>${userCount} Farklı Hesap</strong> · Kaynak IP: <strong>${esc(inc.ip || 'Bilinmiyor')}</strong>`}</p>
      </div>
    </div>

    <div class="remediation-steps">
      <div class="remediation-card">
        <div class="remediation-card-header">
          <div class="remediation-step-badge">1</div>
          <div>
            <strong>${isEn ? `Revoke Sessions for All Targeted Accounts (${userCount} Users)` : `Hedeflenen Tüm Hesapların Oturumlarını Topluca İptal Et (${userCount} Kullanıcı)`}</strong>
            <p class="remediation-desc">${isEn ? 'Even if the attacker guessed passwords or opened sessions for any of these users, a single PowerShell loop invalidates all active sessions and ejects the attacker.' : 'Saldırgan bu kullanıcılardan herhangi birinin parolasını tahmin etmiş veya oturum açmış olsa bile, tek bir PowerShell döngüsüyle tüm açık oturumları kapatıp saldırganı dışarı atar.'}</p>
          </div>
        </div>
        <div class="remediation-code-box">
          <code>${esc(sprayUsersCode)}\n\n${esc(revokeCmd)}</code>
          <button type="button" class="btn copy-btn" data-copy="${esc(sprayUsersCode + '\n\n' + revokeCmd)}">${isEn ? '📋 Copy Code' : '📋 Kodu Kopyala'}</button>
        </div>
      </div>

      <div class="remediation-card">
        <div class="remediation-card-header">
          <div class="remediation-step-badge">2</div>
          <div>
            <strong>${isEn ? 'Enforce Password Reset for Targeted Users' : 'Hedeflenen Kullanıcılarda Parola Değişimini Zorunlu Kıl'}</strong>
            <p class="remediation-desc">${isEn ? 'Requires all target users to set a new password upon their next sign-in.' : 'Tüm hedef kullanıcıların bir sonraki oturum açılışında yeni parola belirlemelerini zorunlu kılar.'}</p>
          </div>
        </div>
        <div class="remediation-code-box">
          <code>${esc(sprayUsersCode)}\n\n${esc(resetCmd)}</code>
          <button type="button" class="btn copy-btn" data-copy="${esc(sprayUsersCode + '\n\n' + resetCmd)}">${isEn ? '📋 Copy Code' : '📋 Kodu Kopyala'}</button>
        </div>
      </div>

      ${ipBlockStep}
    </div>
  `;

  $('#detail-body').innerHTML = html;
  $('#detail').showModal();
}

function showRemediation(id) {
  const isEn = getLang() === 'en';
  const u = data?.users?.find(x => x.id === id || x.email === id);
  if (!u) return;

  const relatedIncidents = (data?.incidents || []).filter(inc => (inc.users || []).includes(u.id));
  const incidentIps = relatedIncidents.flatMap(inc => inc.ip ? [inc.ip] : (inc.ips || []));
  const eventIps = (u.events || []).filter(e => [50053, 50126].includes(Number(e.status?.errorCode)) && !e.trustedIp && e.ipAddress).map(e => e.ipAddress);
  const userIps = [...new Set([...incidentIps, ...eventIps])];

  let ipBlockStep = '';
  if (userIps.length > 0) {
    const rawIpList = userIps.map(ip => `  "${ip}"`).join(',\n');
    const ipCode = `$BlockedIPs = @(\n${rawIpList}\n)`;
    const previewIps = userIps.slice(0, 8).map(ip => `  "${ip}"`).join(',\n');
    const previewCode = `$BlockedIPs = @(\n${previewIps}${userIps.length > 8 ? `,\n  # ... (+${userIps.length - 8} ${isEn ? 'more IPs' : 'IP daha'})` : ''}\n)`;

    ipBlockStep = `
    <div class="remediation-card">
      <div class="remediation-card-header">
        <div class="remediation-step-badge">5</div>
        <div>
          <strong>${isEn ? `Get Attacker IP Addresses as Block List (${userIps.length} Unique IPs)` : `Saldıran IP Adreslerini Bloklama Listesi Olarak Al (${userIps.length} Farklı IP)`}</strong>
          <p class="remediation-desc">${isEn ? 'PowerShell array list ready to export attacker IP addresses targeting this account into Firewall, WAF, or Microsoft Entra ID Named Location block rules.' : 'Bu hesabı hedef alan saldırgan IP adreslerini Firewall, WAF veya Microsoft Entra ID Named Location engelleme kuralına aktarmak için hazır PowerShell dizi listesi.'}</p>
        </div>
      </div>
      <div class="remediation-code-box">
        <code>${esc(previewCode)}</code>
        <button type="button" class="btn copy-btn" data-copy="${esc(ipCode)}">${isEn ? "📋 Copy All IPs" : "📋 Tüm IP'leri Kopyala"}</button>
      </div>
    </div>`;
  }

  const revokeCmd = `Revoke-MgUserSignInSession -UserId "${u.email}"`;
  const resetCmd = `Update-MgUser -UserId "${u.email}" -PasswordProfile @{ ForceChangePasswordNextSignIn = $true }`;
  const disableCmd = `Update-MgUser -UserId "${u.email}" -AccountEnabled $false`;
  const tapCmd = `New-MgUserAuthenticationTemporaryAccessPassMethod -UserId "${u.email}" -LifetimeInMinutes 60 -IsUsableOnce $true`;
  const caGroupCmd = `# ${isEn ? 'Add User to Mandatory MFA Security Group (Update Group ID for your environment)' : "Kullanıcıyı MFA Zorunlu Güvenlik Grubuna Ekle (Grup ID'sini ortamınıza göre güncelleyin)"}\n$TargetUser = Get-MgUser -UserId "${u.email}"\nAdd-MgGroupMember -GroupId "<MFA_GRUP_OBJECT_ID>" -DirectoryObjectId $TargetUser.Id`;
  const msolMfaCmd = `# ${isEn ? 'Enforce Per-User MFA via MSOnline (Connect-MsolService required)' : 'MSOnline ile Per-User MFA Zorunlu Kıl (Connect-MsolService gereklidir)'}\n$auth = New-Object -TypeName Microsoft.Online.Administration.StrongAuthenticationRequirement\n$auth.RelyingParty = "*"\n$auth.State = "Enforced"\nSet-MsolUser -UserPrincipalName "${u.email}" -StrongAuthenticationRequirements @($auth)`;

  const html = `
    <div class="remediation-header">
      <div>
        <div class="eyebrow eyebrow-accent">${isEn ? 'Cyber Threat Response (ITDR Response)' : 'Siber Tehdit Müdahalesi (ITDR Response)'}</div>
        <h2>${isEn ? '⚡ Emergency Remediation Plan' : '⚡ Acil Müdahale &amp; İyileştirme Planı'}</h2>
        <p class="subtle subtle-zero-margin">${isEn ? `Target Account: <strong>${esc(u.name)}</strong> (${esc(u.email)}) · Priority Score: <strong>${u.score}/100</strong>` : `Hedef Hesap: <strong>${esc(u.name)}</strong> (${esc(u.email)}) · Öncelik Skoru: <strong>${u.score}/100</strong>`}</p>
      </div>
      <button type="button" class="btn back-to-user-btn" data-user="${esc(u.id)}">${isEn ? '← Back to User Profile' : '← Kullanıcı Profiline Dön'}</button>
    </div>

    <div class="remediation-steps">
      <div class="remediation-card">
        <div class="remediation-card-header">
          <div class="remediation-step-badge">1</div>
          <div>
            <strong>${isEn ? 'Revoke All Active Sessions (Session Revocation)' : 'Tüm Aktif Oturumları İptal Et (Session Revocation)'}</strong>
            <p class="remediation-desc">${isEn ? 'Even if an attacker obtained passwords or session cookies, this command immediately invalidates all user browser, mobile, Outlook, and Teams session tokens to eject the attacker.' : 'Saldırgan parola veya çerez (session cookie) ele geçirmiş olsa bile, bu komut kullanıcının tüm tarayıcılardaki, telefonlardaki, Outlook ve Teams oturum jetonlarını anında geçersiz kılarak saldırganı dışarı atar.'}</p>
          </div>
        </div>
        <div class="remediation-code-box">
          <code>${esc(revokeCmd)}</code>
          <button type="button" class="btn copy-btn" data-copy="${esc(revokeCmd)}">${isEn ? '📋 Copy' : '📋 Kopyala'}</button>
        </div>
      </div>

      <div class="remediation-card">
        <div class="remediation-card-header">
          <div class="remediation-step-badge">2</div>
          <div>
            <strong>${isEn ? 'Enforce Password Change on Next Sign-in' : 'Bir Sonraki Girişte Parola Değişimini Zorunlu Kıl'}</strong>
            <p class="remediation-desc">${isEn ? 'User cannot sign in with current password; redirected directly to Microsoft verification screen to set a new strong password.' : 'Kullanıcı mevcut parolasıyla giriş yapamaz; doğrudan Microsoft doğrulama ekranına düşerek yeni ve güçlü bir parola belirlemek zorunda kalır.'}</p>
          </div>
        </div>
        <div class="remediation-code-box">
          <code>${esc(resetCmd)}</code>
          <button type="button" class="btn copy-btn" data-copy="${esc(resetCmd)}">${isEn ? '📋 Copy' : '📋 Kopyala'}</button>
        </div>
      </div>

      <div class="remediation-card">
        <div class="remediation-card-header">
          <div class="remediation-step-badge">3</div>
          <div>
            <strong>${isEn ? 'Temporarily Suspend Account (Optional Emergency Kill-Switch)' : 'Hesabı Geçici Olarak Askıya Al (İsteğe Bağlı Acil Durdurma)'}</strong>
            <p class="remediation-desc">${isEn ? 'If attack intensity is high or user cannot be contacted yet, immediately revokes sign-in access until incident is resolved.' : 'Saldırı çok yoğunsa veya personelle henüz irtibat kurulamadıysa, olay netleşene kadar hesabın giriş yetkisini anında kapatır.'}</p>
          </div>
        </div>
        <div class="remediation-code-box">
          <code>${esc(disableCmd)}</code>
          <button type="button" class="btn copy-btn" data-copy="${esc(disableCmd)}">${isEn ? '📋 Copy' : '📋 Kopyala'}</button>
        </div>
      </div>

      <div class="remediation-card">
        <div class="remediation-card-header">
          <div class="remediation-step-badge">4</div>
          <div>
            <strong>${isEn ? 'Enable MFA Authentication (3 Options Based on License)' : 'MFA Doğrulamasını Devreye Al (Lisansa Göre 3 Seçenek)'}</strong>
            <p class="remediation-desc">${isEn ? 'Select the method suitable for your tenant license to secure the account and enforce Multi-Factor Authentication (MFA) on next sign-in:' : 'Kullanıcının hesabını güvenceye almak ve bir sonraki oturumunda çok faktörlü doğrulamayı (MFA) zorlamak için tenant lisansınıza uygun yöntemi seçin:'}</p>
          </div>
        </div>

        <div class="mfa-step-subcard">
          <div class="mfa-step-subcard-header">
            <div>
              <strong>${isEn ? '4.1. Passwordless MFA Onboarding via TAP (Temporary Access Pass)' : '4.1. TAP (Geçici Erişim Kodu) İle Parolasız MFA Tanımlatma'}</strong>
              <p class="remediation-desc">${isEn ? 'Generates a single-use 60-min passcode; user accesses https://aka.ms/mysecurityinfo directly to register Authenticator/FIDO2 without entering a password.' : 'Kullanıcı için tek kullanımlık 60 dk geçerli kod üretir; kullanıcı https://aka.ms/mysecurityinfo adresinden parola sormadan doğrudan Authenticator/FIDO2 kaydeder.'}</p>
            </div>
            <span class="license-tag tag-p1-free">${isEn ? 'NO P1 REQUIRED · ALL M365 PLANS' : 'P1 GEREKMEZ · TÜM M365 PLANLARI'}</span>
          </div>
          <div class="remediation-code-box">
            <code>${esc(tapCmd)}</code>
            <button type="button" class="btn copy-btn" data-copy="${esc(tapCmd)}">${isEn ? '📋 Copy' : '📋 Kopyala'}</button>
          </div>
        </div>

        <div class="mfa-step-subcard">
          <div class="mfa-step-subcard-header">
            <div>
              <strong>${isEn ? '4.2. Add to Conditional Access MFA Security Group (Enterprise Standard)' : '4.2. Conditional Access MFA Güvenlik Grubuna Ekle (Kurumsal Standart)'}</strong>
              <p class="remediation-desc">${isEn ? 'Adds user to security group bound to "MFA Required" CA policy. MFA is enforced on next sign-in.' : 'Kullanıcıyı "MFA Zorunlu" CA politikasına bağlı güvenlik grubuna ekler. Bir sonraki oturumda MFA şart koşulur.'}</p>
            </div>
            <span class="license-tag tag-p1-req">${isEn ? 'ENTRA ID P1 / P2 REQUIRED' : 'ENTRA ID P1 / P2 GEREKİR'}</span>
          </div>
          <div class="remediation-code-box">
            <code>${esc(caGroupCmd)}</code>
            <button type="button" class="btn copy-btn" data-copy="${esc(caGroupCmd)}">${isEn ? '📋 Copy' : '📋 Kopyala'}</button>
          </div>
        </div>

        <div class="mfa-step-subcard">
          <div class="mfa-step-subcard-header">
            <div>
              <strong>${isEn ? '4.3. Enforce Per-User MFA Status' : '4.3. Per-User (Kullanıcı Başına) MFA Durumunu Enforce Yap'}</strong>
              <p class="remediation-desc">${isEn ? 'Enforces MFA directly on basic or free M365 plans via MSOnline module.' : 'Temel veya ücretsiz M365 planlarında MSOnline modülü ile kullanıcıyı doğrudan zorunlu MFA durumuna alır.'}</p>
            </div>
            <span class="license-tag tag-msonline">${isEn ? 'NO P1 REQUIRED · MSOnline Module' : 'P1 GEREKMEZ · MSOnline Modülü'}</span>
          </div>
          <div class="remediation-code-box">
            <code>${esc(msolMfaCmd)}</code>
            <button type="button" class="btn copy-btn" data-copy="${esc(msolMfaCmd)}">${isEn ? '📋 Copy' : '📋 Kopyala'}</button>
          </div>
        </div>
      </div>

      ${ipBlockStep}
    </div>
  `;

  $('#detail-body').innerHTML = html;
  $('#detail').showModal();
}

function remediationPage() {
  const isEn = getLang() === 'en';
  const users = (data?.users || []).filter(isHumanUser);
  const incidents = data?.incidents || [];
  const targets = users.filter(u => u.score >= 50 || u.reviewState === 'critical' || u.reviewState === 'urgent' || incidents.some(inc => (inc.users || []).includes(u.id)));
  targets.sort((a,b) => b.score - a.score || b.fails - a.fails || a.name.localeCompare(b.name, 'tr'));

  const psInstallGraph = `# 1. ${isEn ? 'Install Microsoft Graph PowerShell SDK Modules (Admin PowerShell)' : 'Microsoft Graph PowerShell SDK Modüllerini Yükleme (Yönetici PowerShell)'}\nInstall-Module Microsoft.Graph.Authentication, Microsoft.Graph.Users, Microsoft.Graph.Identity.SignIns, Microsoft.Graph.Groups -Scope CurrentUser -Repository PSGallery -Force`;
  const psConnectGraph = `# 2. ${isEn ? 'Connect to Microsoft Graph (With Required Scopes)' : 'Microsoft Graph Bağlantısı (Gerekli Kapsamlar İle)'}\nConnect-MgGraph -Scopes "User.ReadWrite.All", "Directory.ReadWrite.All", "UserAuthenticationMethod.ReadWrite.All", "GroupMember.ReadWrite.All"`;
  const psMsolPrereq = `# 3. ${isEn ? '(Optional) MSOnline Module (For Legacy Per-User MFA)' : '(İsteğe Bağlı) MSOnline Modülü (Eski Nesil Per-User MFA için)'}\nInstall-Module MSOnline -Scope CurrentUser -Repository PSGallery -Force\nConnect-MsolService`;

  const mfaTapGeneric = `# ${isEn ? 'Generate TAP (Temporary Access Pass) - Directs user to MFA registration' : 'TAP (Temporary Access Pass) Üretme - Kullanıcıyı doğrudan MFA kaydına yönlendirir'}\nNew-MgUserAuthenticationTemporaryAccessPassMethod -UserId "kullanici@sirket.com" -LifetimeInMinutes 60 -IsUsableOnce $true`;
  const mfaCaGeneric = `# ${isEn ? 'Add to Conditional Access MFA Required Group' : 'Conditional Access MFA Zorunlu Grubuna Ekleme'}\n$User = Get-MgUser -UserId "kullanici@sirket.com"\nAdd-MgGroupMember -GroupId "<MFA_POLICY_GROUP_OBJECT_ID>" -DirectoryObjectId $User.Id`;
  const mfaPerUserGeneric = `# ${isEn ? 'Set Per-User MFA State to "Enforced"' : 'Per-User (Kullanıcı Başına) MFA Durumunu "Enforced" Yapma'}\n$auth = New-Object -TypeName Microsoft.Online.Administration.StrongAuthenticationRequirement\n$auth.RelyingParty = "*"\n$auth.State = "Enforced"\nSet-MsolUser -UserPrincipalName "kullanici@sirket.com" -StrongAuthenticationRequirements @($auth)`;

  return `
    <div class="heading">
      <div>
        <div class="eyebrow">${isEn ? 'ITDR Remediation Hub' : 'Siber Tehdit ve Acil Müdahale Merkezi (ITDR Remediation Hub)'}</div>
        <h1>${isEn ? 'Remediation and Response Console' : 'Acil Müdahale ve İyileştirme Konsolu'}</h1>
        <p>${isEn ? 'PowerShell-based session revocation, password reset, account lockout, and MFA enforcement center.' : 'PowerShell tabanlı anlık oturum kapatma, parola yenileme, hesap dondurma ve MFA zorlama merkezi.'}</p>
      </div>
    </div>

    <div class="remediation-hub">
      <!-- Master Safety Interlock Switch -->
      <section class="panel master-switch-card ${isRemediationEnabled() ? 'active' : ''}">
        <div class="master-switch-row">
          <div class="master-switch-info">
            <div class="switch-eyebrow">
              <span class="badge-lock">${isEn ? '🔒 SAFETY INTERLOCK' : '🔒 GÜVENLİK KİLİDİ'}</span>
              <span>${isEn ? 'MASTER CONTROL SWITCH' : 'MASTER KONTROL ANAHTARI'}</span>
            </div>
            <h3>${isEn ? '⚡ Portal-wide Emergency Response Buttons' : '⚡ Portal Genelinde Acil Müdahale Butonları'}</h3>
            <p class="remediation-desc">
              ${isEn ? 'To ensure operational safety and prevent accidental triggers, the <strong>⚡ Response Code</strong> buttons across the portal (User Table, Attack Cards, and MFA Recommendations) are bound to this switch by default. When enabled, response buttons appear instantly across all views.' : 'Operasyonel güvenliği sağlamak ve yanlışlıkla işlem yapılmasını önlemek amacıyla portal genelindeki (Kullanıcı Tablosu, Saldırı Kartları ve MFA Önerileri) <strong>⚡ Müdahale Kodu</strong> butonları varsayılan olarak bu anahtara bağlıdır. Açıldığında tüm ekranlarda müdahale butonları anında görünür ve aktif hale gelir.'}
            </p>
          </div>
          <div class="master-switch-controls">
            <span class="status-pill ${isRemediationEnabled() ? 'status-pill-active' : 'status-pill-inactive'}">
              ${isRemediationEnabled() ? (isEn ? '● Buttons ACTIVE' : '● Butonlar AKTİF') : (isEn ? '○ Buttons HIDDEN' : '○ Butonlar GİZLİ')}
            </span>
            <label class="toggle-switch">
              <input type="checkbox" id="remediation-toggle-switch" ${isRemediationEnabled() ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>

      <!-- Prerequisites & Required Components Guide Accordion -->
      <details class="remediation-accordion">
        <summary class="remediation-accordion-summary">
          <div class="accordion-title-group">
            <span class="accordion-icon">🛠️</span>
            <div>
              <h3>${isEn ? 'Required PowerShell Components & Setup' : 'Gerekli PowerShell Bileşenleri ve Ön Hazırlık'}</h3>
              <small>${isEn ? 'One-time prerequisite installation and connection steps in admin PowerShell before running commands.' : 'Komutları çalıştırmadan önce yönetici PowerShell oturumunda bir kez yapılması gereken yüklemeler ve bağlantı adımları.'}</small>
            </div>
          </div>
          <div class="accordion-right">
            <span class="accordion-toggle-tag">
              ${isEn ? 'Open / Close Guide' : 'Kılavuzu Aç / Kapat'}
              <span class="accordion-arrow">▾</span>
            </span>
          </div>
        </summary>
        <div class="remediation-accordion-body">
          <p>
            ${isEn ? 'Emergency scripts generated by IDSignal use the official <strong>Microsoft Graph PowerShell SDK</strong>. Complete the following steps in sequence on your workstation (Windows PowerShell 5.1 or PowerShell 7+) using a Global Admin, Privileged Role Admin, or Security Admin account:' : 'IDSignal\'ın ürettiği acil müdahale betikleri doğrudan resmi <strong>Microsoft Graph PowerShell SDK</strong> altyapısını kullanır. Tenant\'ınızda Global Admin, Privileged Role Admin veya Security Admin yetkisine sahip bir hesapla yerel bilgisayarınızda (Windows PowerShell 5.1 veya PowerShell 7+) aşağıdaki adımları sırayla tamamlayın:'}
          </p>

          <div class="prereq-grid">
            <div class="prereq-card">
              <h4><span>1.</span> ${isEn ? 'Install Microsoft Graph Modules' : 'Microsoft Graph Modüllerini Yükleyin'}</h4>
              <p class="remediation-desc">${isEn ? 'Installs official modules required for user management, session revocation, TAP generation, and group memberships.' : 'Kullanıcı yönetimi, oturum iptali, TAP üretimi ve grup üyelikleri için gerekli resmi modülleri kurar.'}</p>
              <div class="remediation-code-box">
                <code>${esc(psInstallGraph)}</code>
                <button type="button" class="btn copy-btn" data-copy="${esc(psInstallGraph)}">${isEn ? '📋 Copy' : '📋 Kopyala'}</button>
              </div>
            </div>

            <div class="prereq-card">
              <h4><span>2.</span> ${isEn ? 'Connect to Graph with Required Scopes' : 'Gerekli Kapsamlarla Graph\'a Bağlanın'}</h4>
              <p class="remediation-desc">${isEn ? 'Establishes authenticated session with consent for session revocation, password resets, and MFA/group remediation.' : 'Oturum kapatma, parola güncelleme ve MFA/grup müdahaleleri için onaylı erişim oturumu açar.'}</p>
              <div class="remediation-code-box">
                <code>${esc(psConnectGraph)}</code>
                <button type="button" class="btn copy-btn" data-copy="${esc(psConnectGraph)}">${isEn ? '📋 Copy' : '📋 Kopyala'}</button>
              </div>
            </div>
          </div>

          <div class="prereq-card banner-mt-16">
            <h4><span>3.</span> ${isEn ? '(Optional) Install MSOnline Module' : '(İsteğe Bağlı) MSOnline Modülü Kurulumu'}</h4>
            <p class="remediation-desc">${isEn ? 'Required if you do not have an Entra ID P1 license and wish to enforce legacy Per-User MFA:' : 'Eğer Entra ID P1 lisansınız yoksa ve eski yöntem Per-User (Kullanıcı Başına) MFA zorlamak istiyorsanız gereklidir:'}</p>
            <div class="remediation-code-box">
              <code>${esc(psMsolPrereq)}</code>
              <button type="button" class="btn copy-btn" data-copy="${esc(psMsolPrereq)}">${isEn ? '📋 Copy' : '📋 Kopyala'}</button>
            </div>
          </div>
        </div>
      </details>

      <!-- Flawless MFA Enforcement Methods & License Guide Accordion -->
      <details class="remediation-accordion">
        <summary class="remediation-accordion-summary">
          <div class="accordion-title-group">
            <span class="accordion-icon">🔐</span>
            <div>
              <h3>${isEn ? 'PowerShell MFA Enforcement Methods & License Guide' : 'PowerShell İle MFA Etkinleştirme Yöntemleri & Lisans Kılavuzu'}</h3>
              <small>${isEn ? 'Select the best method matching your license type and organizational policy.' : 'Lisans tipinize ve kurumsal politikanıza en uygun yöntemi seçin; hiçbir yere takılmadan uygulayın.'}</small>
            </div>
          </div>
          <div class="accordion-right">
            <span class="accordion-toggle-tag">
              ${isEn ? 'Open / Close Guide' : 'Kılavuzu Aç / Kapat'}
              <span class="accordion-arrow">▾</span>
            </span>
          </div>
        </summary>
        <div class="remediation-accordion-body">
          <p>
            ${isEn ? 'There are 3 ways to enforce MFA on users via PowerShell in Microsoft Entra ID. Select the method compatible with your license tier to protect users immediately:' : 'Microsoft Entra ID ortamında PowerShell ile kullanıcılara MFA tanımlamanın 3 farklı yolu vardır. Lisans tipinize uygun yöntemi seçerek kullanıcıyı doğrudan koruma altına alabilirsiniz:'}
          </p>

          <div class="mfa-methods-container">
            <!-- Method 1: TAP -->
            <div class="mfa-method-card">
              <div class="mfa-method-header">
                <div class="mfa-method-title">
                  <div class="remediation-step-badge">1</div>
                  <strong>${isEn ? 'Method 1: Direct MFA Onboarding via TAP (Temporary Access Pass)' : 'Yöntem 1: TAP (Temporary Access Pass) İle Doğrudan MFA Kaydı Yaptırma'}</strong>
                </div>
                <span class="license-tag tag-p1-free">${isEn ? 'NO P1 / P2 REQUIRED · ALL M365 PLANS' : 'P1 / P2 GEREKMEZ · TÜM M365 PLANLARI'}</span>
              </div>
              <p class="mfa-method-desc">
                <strong>${isEn ? 'Required Module:' : 'Gerekli Modül:'}</strong> <code>Microsoft.Graph.Identity.SignIns</code><br>
                <strong>${isEn ? 'How it works:' : 'Nasıl Çalışır:'}</strong> ${isEn ? 'Generates a single-use 60-min passcode (TAP) for the user. Give this code to employee instead of a password. Employee signs in to <code>https://aka.ms/mysecurityinfo</code> to complete Microsoft Authenticator or FIDO2 setup without password entry.' : 'Kullanıcı için 60 dakika geçerli, tek kullanımlık bir Geçici Erişim Kodu (TAP) üretir. Personele yeni parola vermek yerine bu kod verilir. Personel <code>https://aka.ms/mysecurityinfo</code> adresine bu kodla girdiğinde parola sormadan doğrudan Microsoft Authenticator veya FIDO2 güvenlik anahtarı kurulumunu tamamlar.'}
              </p>
              <div class="remediation-code-box">
                <code>${esc(mfaTapGeneric)}</code>
                <button type="button" class="btn copy-btn" data-copy="${esc(mfaTapGeneric)}">${isEn ? '📋 Copy Command' : '📋 Komutu Kopyala'}</button>
              </div>
            </div>

            <!-- Method 2: Conditional Access Group -->
            <div class="mfa-method-card">
              <div class="mfa-method-header">
                <div class="mfa-method-title">
                  <div class="remediation-step-badge">2</div>
                  <strong>${isEn ? 'Method 2: Add to Conditional Access MFA Security Group (Recommended Standard)' : 'Yöntem 2: Conditional Access MFA Güvenlik Grubuna Ekleme (Önerilen Modern Standart)'}</strong>
                </div>
                <span class="license-tag tag-p1-req">${isEn ? 'ENTRA ID P1 / P2 LICENSE REQUIRED' : 'ENTRA ID P1 / P2 LİSANSI GEREKİR'}</span>
              </div>
              <p class="mfa-method-desc">
                <strong>${isEn ? 'Required Module:' : 'Gerekli Modül:'}</strong> <code>Microsoft.Graph.Groups</code> &amp; <code>Microsoft.Graph.Users</code><br>
                <strong>${isEn ? 'How it works:' : 'Nasıl Çalışır:'}</strong> ${isEn ? 'Adds target user to security group bound to "Require MFA" CA policy. User cannot access corporate apps without MFA on next sign-in.' : 'Kurumunuzda "MFA Zorunlu Tut" Conditional Access kuralına atanmış bir güvenlik grubunuz (ör. <em>MFA-Enforced-Users</em>) varsa, hedef kullanıcıyı doğrudan bu gruba ekler. Kullanıcı bir sonraki oturum açılışında MFA olmadan hiçbir kurumsal uygulamaya (M365, Teams, Outlook) erişemez. En kurumsal ve güvenilir yöntemdir.'}
              </p>
              <div class="remediation-code-box">
                <code>${esc(mfaCaGeneric)}</code>
                <button type="button" class="btn copy-btn" data-copy="${esc(mfaCaGeneric)}">${isEn ? '📋 Copy Command' : '📋 Komutu Kopyala'}</button>
              </div>
            </div>

            <!-- Method 3: Per-User MFA Enforce -->
            <div class="mfa-method-card">
              <div class="mfa-method-header">
                <div class="mfa-method-title">
                  <div class="remediation-step-badge">3</div>
                  <strong>${isEn ? 'Method 3: Per-User Legacy MFA Enforcement (Enforced)' : 'Yöntem 3: Per-User (Kullanıcı Başına) Eski Nesil MFA Zorlama (Enforced)'}</strong>
                </div>
                <span class="license-tag tag-msonline">${isEn ? 'NO P1 REQUIRED · ALL BASIC PLANS (MSOnline)' : 'P1 GEREKMEZ · TÜM TEMEL PLANLAR (MSOnline)'}</span>
              </div>
              <p class="mfa-method-desc">
                <strong>${isEn ? 'Required Module:' : 'Gerekli Modül:'}</strong> <code>MSOnline</code><br>
                <strong>${isEn ? 'How it works:' : 'Nasıl Çalışır:'}</strong> ${isEn ? 'Sets user multi-factor authentication state directly to <code>Enforced</code> on SMB and basic packages without Entra ID P1.' : 'Microsoft Entra ID P1 lisansı bulunmayan KOBİ ve temel paketlerde, kullanıcının çok faktörlü kimlik doğrulama durumunu doğrudan <code>Enforced</code> (Zorunlu) seviyesine çeker. Kullanıcı mevcut oturumu kapandıktan sonra MFA yapılandırmadan içeri alınmaz.'}
              </p>
              <div class="remediation-code-box">
                <code>${esc(mfaPerUserGeneric)}</code>
                <button type="button" class="btn copy-btn" data-copy="${esc(mfaPerUserGeneric)}">${isEn ? '📋 Copy Command' : '📋 Komutu Kopyala'}</button>
              </div>
            </div>
          </div>
        </div>
      </details>

      <!-- Active Remediation Targets Table -->
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>${isEn ? `🎯 Target Accounts Requiring Emergency Response (${targets.length})` : `🎯 Acil Müdahale Gerektiren Hedef Hesaplar (${targets.length})`}</h2>
            <small>${isEn ? 'Users with priority score 50+, suspicious sessions detected, or under active attack.' : 'Öncelik skoru 50 ve üzeri, şüpheli oturum tespit edilmiş veya aktif saldırı altında olan kullanıcılar.'}</small>
          </div>
        </div>
        <div class="panel-body">
          ${targets.length ? `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>${isEn ? 'USER' : 'KULLANICI'}</th>
                    <th>${isEn ? 'RISK &amp; PRIORITY' : 'RİSK &amp; ÖNCELİK'}</th>
                    <th>${isEn ? 'THREAT SIGNAL' : 'TEHDİT SİNYALİ'}</th>
                    <th>${isEn ? 'MFA STATUS' : 'MFA DURUMU'}</th>
                    <th>${isEn ? 'ACTION' : 'EYLEM'}</th>
                  </tr>
                </thead>
                <tbody>
                  ${targets.map(u => {
                    const isMfa = u.mfa === true;
                    const summary = formatRiskSummary(u);
                    return `
                      <tr>
                        <td>
                          <button class="user-button" data-user="${esc(u.id)}">
                            <strong>${esc(u.name)}</strong>
                            <small>${esc(u.email)}</small>
                          </button>
                        </td>
                        <td>
                          <span class="pill ${u.score >= 70 ? 'high' : u.score >= 40 ? 'mid' : 'low'}">${u.score} / 100</span>
                          ${reviewPill(u)}
                        </td>
                        <td>
                          <small>${isEn ? `<strong>${u.ips || 0} Unique IPs</strong> · ${u.passwordFails || 0} password fails` : `<strong>${u.ips || 0} Farklı IP</strong> · ${u.passwordFails || 0} hatalı parola`}</small>
                          ${summary ? `<div class="table-reason urgent-reason">${esc(summary)}</div>` : ''}
                        </td>
                        <td>
                          <span class="pill ${isMfa ? 'low' : 'high'}">${isMfa ? (isEn ? 'Enabled' : 'Etkin') : (isEn ? 'None' : 'Yok')}</span>
                        </td>
                        <td>
                          <button type="button" class="btn btn-table-action remediation-trigger-btn" data-remediation-user="${esc(u.id)}">${isEn ? '⚡ Response Code' : '⚡ Müdahale Kodu'}</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty">
              <b>${isEn ? '🎉 Great! There are no high-risk accounts requiring emergency response.' : '🎉 Harika! Şu anda acil müdahale gerektiren yüksek riskli hesap bulunmuyor.'}</b>
              ${isEn ? 'All accounts with score above 50 or under active attack in the selected analysis period are secured.' : 'Seçilen analiz döneminde skoru 50 üzerinde olan veya aktif saldırı altındaki tüm hesaplar kontrol altında.'}
            </div>
          `}
        </div>
      </section>
    </div>
  `;
}

function showUser(id){
  const isEn = getLang() === 'en';
  const u = data.users.find(u=>u.id===id);
  if (!u) return;
  const suc = u.successes || 0;
  const fail = u.fails || 0;
  const total = suc + fail;
  let pieChart = '';
  if (total > 0) {
    const sucPct = Math.round((suc / total) * 100);
    const dash = (sucPct / 100) * 100.53;
    pieChart = `<div class="user360-panel">
      <div class="user360-chart-container">
        <svg class="user360-chart-svg" viewBox="0 0 32 32">
          <circle r="16" cx="16" cy="16" fill="var(--red)"/>
          <circle r="16" cx="16" cy="16" fill="none" stroke="var(--green)" stroke-width="32" stroke-dasharray="${dash} 100.53"/>
          <circle r="10" cx="16" cy="16" fill="var(--panel)"/>
        </svg>
        <div class="user360-chart-center">%${sucPct}</div>
      </div>
      <div class="user360-info">
        <div class="eyebrow eyebrow-success">${isEn ? 'User 360 · Behavior & Risk Summary' : 'User 360 · Davranış ve Risk Özeti'}</div>
        <p>${isEn ? `Total <strong>${fmt(total)}</strong> sign-in attempts analyzed over the last <strong>${days} days</strong>.` : `Son <strong>${days} gün</strong> içinde toplam <strong>${fmt(total)}</strong> oturum denemesi analiz edildi.`}</p>
        <div class="user360-breakdown">
          <span class="user360-stat-pill user360-stat-success">● ${isEn ? `${sucPct}% Successful (${fmt(suc)})` : `% ${sucPct} Başarılı (${fmt(suc)})`}</span>
          <span class="user360-stat-pill user360-stat-fail">● ${isEn ? `${100 - sucPct}% Failed / Locked (${fmt(fail)})` : `% ${100 - sucPct} Başarısız / Kilitli (${fmt(fail)})`}</span>
          <span class="user360-stat-pill">🌐 ${isEn ? `${u.ips || 0} Unique IPs` : `${u.ips || 0} Farklı IP`}</span>
        </div>
      </div>
    </div>`;
  }
  $('#detail-body').innerHTML = `
    <div class="user-modal-header">
      <div>
        <div class="eyebrow">${isEn ? 'User Inspection' : 'Kullanıcı incelemesi'}</div>
        <h2>${esc(u.name)}</h2>
        <p>${esc(u.email)} · ${mfaPill(u.mfa)} · ${reviewPill(u)}</p>
      </div>
      ${isRemediationEnabled() ? `<button class="btn primary remediation-trigger-btn" data-remediation-user="${esc(u.id)}">${isEn ? '⚡ Emergency Response (PowerShell) →' : '⚡ Acil Müdahale (PowerShell) →'}</button>` : ''}
    </div>
    ${pieChart}
    <div class="metrics">
      ${metric(isEn ? 'Priority score' : 'Öncelik skoru', u.score, '0-100')}
      ${metric(isEn ? 'Password fails' : 'Hatalı parola', u.passwordFails, isEn ? 'Excl. safe IPs' : 'Güvenli IP hariç')}
      ${metric(isEn ? 'Source IPs' : 'Kaynak IP', u.ips, isEn ? 'IPs in risk score' : 'Risk hesabındaki IP\'ler')}
      ${metric(isEn ? 'Unique countries' : 'Farklı ülke', u.countries || 0, isEn ? 'Source countries' : 'Kaynak ülkeler')}
      ${metric(isEn ? 'Successful' : 'Başarılı', u.successes, isEn ? 'Selected period' : 'Seçilen dönem')}
    </div>
    <h3>${isEn ? 'Score reasons' : 'Skor gerekçeleri'}</h3>
    ${u.reasons.length ? `<ul class="score-reasons">${u.reasons.map(r=>`<li>${r.points?'+'+r.points+' · ':''}${esc(r.text)}</li>`).join('')}</ul>` : `<p>${isEn ? 'No priority signal matching rules.' : 'Kurala uyan öncelik sinyali yok.'}</p>`}
    <h3>${isEn ? 'Sign-in timeline' : 'Giriş zaman çizelgesi'}</h3>
    <p class="hint">${isEn ? `Latest ${u.events.length} of ${fmt(u.eventCount)} total events. Country resolved from IP if missing in Audit log.` : `${fmt(u.eventCount)} olayın en yeni ${u.events.length} kaydı. Ülke, Audit kaydında yoksa IP'den çözümlenir.`}</p>
    <div class="timeline">${u.events.map(e=>{
      const known = e.location?.countryOrRegion,
            geo = e.ipAddress && !known && !e.trustedIp ? `<span data-geo-ip="${esc(e.ipAddress)}">${isEn ? 'Resolving…' : 'Çözümleniyor…'}</span>` : esc(known || (e.trustedIp ? (isEn ? 'Safe network' : 'Güvenli ağ') : (isEn ? 'Country unknown' : 'Ülke bilinmiyor')));
      return `<div class="row">
        <div>
          <strong>${esc(e.appDisplayName || (isEn ? 'Unknown application' : 'Uygulama bilinmiyor'))}</strong>
          <small>${date(e.createdDateTime)} · ${esc(e.ipAddress || (isEn ? 'No IP' : 'IP yok'))} · ${geo}${e.trustedIp ? (isEn ? ' · Safe IP' : ' · Güvenli IP') : ''}</small>
          <small>${esc(e.status?.failureReason || '')}</small>
        </div>
        <span class="pill ${e.trustedIp ? 'low' : e.status?.errorCode === 0 ? 'low' : 'high'}">${e.trustedIp ? (isEn ? 'Safe IP' : 'Güvenli IP') : e.status?.errorCode === 0 ? (isEn ? 'Success' : 'Başarılı') : esc(e.status?.errorCode ?? (isEn ? 'Unknown' : 'Bilinmiyor'))}</span>
      </div>`;
    }).join('') || `<p>${isEn ? 'No sign-in records for this period.' : 'Bu dönemde giriş kaydı yok.'}</p>`}</div>`;

  $('#detail').showModal();
  bindRemediationEvents();
  void resolveTimelineGeo();
}
function bind(){
  const isEn = getLang() === 'en';
  $('#toggle-sidebar')?.addEventListener('click',toggleSidebar);
  applySidebarState();
  $('#audit-form')?.addEventListener('submit',e=>{e.preventDefault();action(async()=>{await api('audit-connection',Object.fromEntries(new FormData(e.target)));e.target.reset();await refresh();render();notify('Audit bağlantısı kaydedildi.');},e.submitter);});
  $('#connect-api')?.addEventListener('click',e=>action(async()=>{await api('connect-api',{});await refresh();render();},e.currentTarget));
  $('#audit-existing')?.addEventListener('click',e=>action(async()=>{await api('audit-connection',{useExisting:true});await refresh();render();},e.currentTarget));
  $('#audit-consent')?.addEventListener('click',e=>action(async()=>{const {url}=await api('consent',{resource:'m365'});location.assign(url);},e.currentTarget));
  $('#audit-sync')?.addEventListener('click',e=>action(async()=>{await api('sync',{});await refresh();render();},e.currentTarget));
  $('#portal-start')?.addEventListener('click',e=>action(async()=>{await api('portal/start',{});await refresh();render();},e.currentTarget));
  for(const [id,listenOnly] of [['portal-continue',false],['portal-listen',true]])$('#'+id)?.addEventListener('click',e=>action(async()=>{if(!$('#portal-tenant-confirm')?.checked)throw Error('Önce Otomasyon tarayıcısında doğru tenant seçimini doğrulayın.');await api('portal/continue',{tenantId:state.connection.tenantId,confirmTenant:true,listenOnly});await refresh();render();},e.currentTarget));
  $('#portal-cancel')?.addEventListener('click',e=>action(async()=>{await api('portal/cancel',{});await refresh();render();},e.currentTarget));
  document.querySelectorAll('[data-license-mode]').forEach(button=>button.addEventListener('click',()=>action(async()=>{await api('mode',{mode:button.dataset.licenseMode});await refresh();render();notify('Çalışma modu güncellendi.');},button)));
  $('#import-form')?.addEventListener('submit',e=>{e.preventDefault();action(async()=>{const file=$('#signins-file').files[0];if(!file)throw Error('Bir JSON dosyası seçin.');if(file.size>20*1024*1024)throw Error('Dosya en fazla 20 MB olabilir. Portaldaki tarih aralığını daraltın.');let document;try{document=JSON.parse((await file.text()).replace(/^\uFEFF/,''));}catch{throw Error('Dosya geçerli JSON içermiyor.');}const result=await api('import-signins',{tenantId:state.connection.tenantId,confirmTenant:$('#confirm-import').checked,document});await refresh();render();notify(result.inserted+' yeni kayıt aktarıldı. '+(result.existing+result.duplicates)+' tekrar atlandı. '+result.expired+' eski kayıt kapsam dışında.');},e.submitter);});
  $('#auth-form')?.addEventListener('submit',e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));action(async()=>{if(!state.initialized&&b.password!==b.confirm)throw Error('Parolalar eşleşmiyor.');state=await api(state.initialized?'login':'setup',{password:b.password,role:b.role});await refresh();render();},e.submitter);});
  $('#admin-mode')?.addEventListener('click',()=>{loginRole='admin';render();});
  $('#viewer-mode')?.addEventListener('click',()=>{loginRole='viewer';render();});
  $('#admin-login')?.addEventListener('click',e=>action(async()=>{await api('logout',{});state=await api('status');data=null;loginRole='admin';render();},e.currentTarget));
  $('#logout')?.addEventListener('click',()=>action(async()=>{await api('logout',{});state=await api('status');data=null;render();}));
  $('#connection-form')?.addEventListener('submit',e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));action(async()=>{await api('connection',b);e.target.reset();await refresh();render();notify('Uygulama kaydedildi. Yönetici onayı adımına geçebilirsiniz.');},e.submitter);});
  $('#bootstrap-form')?.addEventListener('submit',e=>{e.preventDefault();action(async()=>{const b=await api('bootstrap-script',Object.fromEntries(new FormData(e.target)));download('\ufeff'+b.script,'IDSignal-Entra-Kurulum.ps1','text/plain;charset=utf-8');notify('Kurulum betiği indirildi. 30 dakika içinde PowerShell ile çalıştırın.');},e.submitter);});
  $('#settings-form')?.addEventListener('submit',e=>{e.preventDefault();action(async()=>{const b=Object.fromEntries(new FormData(e.target));const res=await api('settings',{intervalMinutes:Number(b.intervalMinutes),initialDays:Number(b.initialDays),safeIps:b.safeIps});await refresh();render();notify('Ayarlar kaydedildi.' + (res.safeIpCount!==undefined?' '+res.safeIpCount+' güvenli IP/ağ tanındı.':''));},e.submitter);});
  $('#viewer-form')?.addEventListener('submit',e=>{e.preventDefault();action(async()=>{const b=Object.fromEntries(new FormData(e.target));await api('viewer-password',{password:b.password});e.target.reset();notify('Ekip parolası başarıyla güncellendi.');},e.submitter);});
  const opSlider=$('#fx-opacity-slider'),spSlider=$('#fx-speed-slider'),agSlider=$('#fx-angle-slider');
  if(opSlider&&spSlider&&agSlider){
    const update=()=>{
      const cur={opacity:parseFloat(opSlider.value),speed:parseFloat(spSlider.value),angle:parseInt(agSlider.value,10)};
      setLightningSettings(cur);
      const opV=$('#fx-opacity-val'),spV=$('#fx-speed-val'),agV=$('#fx-angle-val');
      if(opV)opV.textContent='%' + Math.round(cur.opacity*100);
      if(spV)spV.textContent=cur.speed.toFixed(1)+' sn';
      if(agV)agV.textContent=cur.angle+'°';
    };
    opSlider.addEventListener('input',update);
    spSlider.addEventListener('input',update);
    agSlider.addEventListener('input',update);
    $('#fx-reset-btn')?.addEventListener('click',()=>{
      const def={opacity:0.40,speed:2.4,angle:0};
      opSlider.value=def.opacity;
      spSlider.value=def.speed;
      agSlider.value=def.angle;
      update();
      notify('Şimşek efekti varsayılan ayarlara sıfırlandı.');
    });
    $('#fx-copy-vals-btn')?.addEventListener('click',async()=>{
      const cur=getLightningSettings();
      const txt='Görünürlük: %' + Math.round(cur.opacity*100) + ' (' + cur.opacity + ') · Hız: ' + cur.speed + ' sn · Açı: ' + cur.angle + '°';
      try{await navigator.clipboard.writeText(txt);notify('Değerler panoya kopyalandı: ' + txt);}
      catch{notify('Değerler: ' + txt);}
    });
  }
  $('#consent')?.addEventListener('click',e=>action(async()=>{const {url}=await api('consent',{});location.assign(url);},e.currentTarget));
  $('#sync')?.addEventListener('click',e=>action(async()=>{await api('sync',{});await refresh();render();},e.currentTarget));
  $('#disconnect')?.addEventListener('click',e=>{if(confirm('Bu kurulumdaki bağlantı ve toplanmış veriler kaldırılsın mı? Entra uygulaması silinmez.'))action(async()=>{await api('disconnect',{});await refresh();render();},e.currentTarget);});
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{setupMode=b.dataset.mode;render();}));
  $('#period')?.addEventListener('change', e => {
    const val = Number(e.target.value);
    const label = e.target.selectedOptions[0]?.text || `Son ${val} gün`;
    action(async () => {
      days = val;
      offset = 0;
      const metricsEl = document.querySelector('.metrics');
      let timerInterval = null;
      if (metricsEl) {
        metricsEl.innerHTML = `<div class="period-loading-card">
          <div class="period-loading-spinner"></div>
          <div>
            <strong>${esc(label)} verileri çözümleniyor…</strong>
            <p class="hint">Loglar, MFA durumları ve coğrafi IP konumları hesaplanıyor. <span id="period-timer-txt">0 sn</span></p>
          </div>
        </div>`;
        const start = Date.now();
        timerInterval = setInterval(() => {
          const txt = document.getElementById('period-timer-txt');
          if (txt) txt.textContent = `${Math.floor((Date.now() - start) / 1000)} sn`;
          else clearInterval(timerInterval);
        }, 300);
      }
      try {
        await refresh();
      } finally {
        if (timerInterval) clearInterval(timerInterval);
      }
      render();
    }, e.target);
  });
  $('#export')?.addEventListener('click',csv);
  $('#export-mfa-rec')?.addEventListener('click',csvMfaRec);
  $('#export-ca-json')?.addEventListener('click',exportCaJson);
  $('#ca-help-btn')?.addEventListener('click',()=>{
    $('#detail-body').innerHTML=`<div class="eyebrow">Yardım Kılavuzu</div><h2>Conditional Access Kuralı Nasıl Yüklenir?</h2><div class="spacer"></div><ol class="checklist"><li><a href="https://entra.microsoft.com/" target="_blank">Microsoft Entra Portal</a> adresine gidin.</li><li>Sol menüden <strong>Protection</strong> &gt; <strong>Conditional Access</strong> sayfasına tıklayın.</li><li><strong>Create new policy</strong> butonunun yanındaki oka tıklayın ve <strong>Create new policy from file</strong> (veya Policies &gt; Import) seçeneğini kullanın.</li><li>Buradan indirdiğiniz <code>ConditionalAccessPolicy.json</code> dosyasını seçip yükleyin.</li><li>Kural başlangıçta <strong>Report-only</strong> (Sadece Rapor) modunda yüklenecektir. Etkisini test ettikten sonra kuralı açık (On) duruma getirebilirsiniz.</li></ol>`;
    $('#detail').showModal();
  });
  $('#search')?.addEventListener('input',e=>{search=e.target.value;offset=0;const pos=e.target.selectionStart;render();$('#search').focus();$('#search').setSelectionRange(pos,pos);});
  $('#sort')?.addEventListener('change',e=>{sort=e.target.value;offset=0;render();});
  $('#prev')?.addEventListener('click',()=>{offset=Math.max(0,offset-50);render();});$('#next')?.addEventListener('click',()=>{offset+=50;render();});
  document.querySelectorAll('[data-user]').forEach(b=>b.addEventListener('click',()=>showUser(b.dataset.user)));
  document.querySelectorAll('[data-link]').forEach(el=>el.addEventListener('click',()=>location.hash=el.dataset.link));
  document.querySelectorAll('.filter-tabs [data-filter]').forEach(btn=>btn.addEventListener('click',()=>{const val=btn.dataset.filter;const base=page;location.hash=val?base+'?cat='+val:base;offset=0;}));
  document.querySelectorAll('th[data-sort-col]').forEach(th=>th.addEventListener('click',()=>{sort=th.dataset.sortCol;offset=0;render();}));
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const l = btn.dataset.lang;
      if (l && l !== getLang()) setLang(l);
    });
  });
}
$('#close-detail').addEventListener('click',()=>$('#detail').close());
$('#detail').addEventListener('click',e=>{if(e.target===$('#detail'))$('#detail').close();});
window.addEventListener('hashchange',()=>{offset=0;search='';render();});
async function init(){try{await refresh();render();}catch(e){$('#app').innerHTML='<div class="loading">Sunucuya ulaşılamıyor. Sayfayı yenileyin.</div>';notify(e.message,true);}}
init();
function startRadarWaves(){const wave=document.querySelector('.radar-wave');if(!wave)return;function ping(){wave.classList.remove('active');void wave.offsetWidth;wave.classList.add('active');setTimeout(ping,8000+Math.random()*7000);}ping();}
startRadarWaves();
poll=setInterval(async()=>{if(!state.authenticated||document.hidden)return;try{const previous=JSON.stringify([state.connection,state.auditConnection,state.apiSetup,state.sync,state.config,state.import,state.portal]);const next=await api('status');state=next;if(!next.authenticated){render();return;}if(previous!==JSON.stringify([state.connection,state.auditConnection,state.apiSetup,state.sync,state.config,state.import,state.portal])){data=await api('dashboard?days='+days);pendingRender=true;}if(pendingRender&&!document.activeElement?.matches('input,select,textarea')&&!$('#detail').open){pendingRender=false;render();}}catch{}},4000);






// Global event delegation for remediation, incident response, and copy
document.addEventListener('click', e => {
  const remBtn = e.target.closest('.remediation-trigger-btn');
  if (remBtn) {
    e.preventDefault();
    e.stopPropagation();
    showRemediation(remBtn.dataset.remediationUser);
    return;
  }
  const remIncBtn = e.target.closest('.remediation-incident-btn');
  if (remIncBtn) {
    e.preventDefault();
    e.stopPropagation();
    showIncidentRemediation(Number(remIncBtn.dataset.incidentIdx));
    return;
  }
  const backBtn = e.target.closest('.back-to-user-btn');
  if (backBtn) {
    e.preventDefault();
    e.stopPropagation();
    showUser(backBtn.dataset.user);
    return;
  }
  const copyBtn = e.target.closest('.copy-btn');
  if (copyBtn) {
    e.preventDefault();
    e.stopPropagation();
    copyToClipboard(copyBtn);
    return;
  }
});

document.addEventListener('change', e => {
  if (e.target && e.target.id === 'remediation-toggle-switch') {
    setRemediationEnabled(e.target.checked);
    render();
    notify(e.target.checked
      ? '⚡ Acil Müdahale butonları portal genelinde etkinleştirildi.'
      : '🔒 Acil Müdahale butonları gizlendi (koruma devrede).');
  }
});
