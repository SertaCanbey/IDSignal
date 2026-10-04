import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

let playwright;
try { playwright = createRequire(import.meta.url)('playwright-core'); }
catch { playwright = createRequire(process.execPath)('playwright-core'); }
const { chromium } = playwright;

let chromeAvailable = true;
try {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  await b.close();
} catch {
  chromeAvailable = false;
}

const mockStatus = {
  initialized: true,
  authenticated: true,
  readOnly: false,
  role: 'admin',
  csrf: 'test-csrf',
  connection: { directoryVerified: true, verified: true },
  config: { mode: 'm365' },
  sync: { busy: false }
};

const mockUsers = [
  {
    id: 'user-1',
    name: 'Hüseyin Aydoğan',
    email: 'haydogan@nevoto.com.tr',
    mfa: false,
    score: 100,
    fails: 99,
    passwordFails: 20,
    reviewState: 'urgent',
    ips: 88,
    lockouts: 79,
    reasons: [{ points: 50, text: 'Bir hesap, 30 dakikada ≥ 5 farklı IP’den hedeflendi (dağıtık hesap saldırısı)' }],
    events: [
      { status: { errorCode: 50053 }, ipAddress: '198.51.100.1' },
      { status: { errorCode: 50126 }, ipAddress: '198.51.100.2' }
    ]
  },
  {
    id: 'user-2',
    name: 'Tolga Öztürk',
    email: 'tozturk@nevoto.com.tr',
    mfa: false,
    score: 100,
    fails: 62,
    passwordFails: 13,
    reviewState: 'urgent',
    ips: 59,
    lockouts: 49,
    reasons: [{ points: 50, text: 'Bir hesap, 30 dakikada ≥ 5 farklı IP’den hedeflendi (dağıtık hesap saldırısı)' }],
    events: [
      { status: { errorCode: 50053 }, ipAddress: '198.51.100.3' }
    ]
  }
];

const mockIncidents = [
  {
    type: 'account',
    userId: 'user-1',
    user: 'Hüseyin Aydoğan',
    ips: ['198.51.100.1', '198.51.100.2'],
    users: ['user-1'],
    attempts: 88,
    start: new Date().toISOString(),
    time: new Date().toISOString(),
    apps: ['Azure Portal']
  },
  {
    type: 'spray',
    ip: '203.0.113.55',
    ips: ['203.0.113.55'],
    users: ['user-1', 'user-2'],
    attempts: 120,
    start: new Date().toISOString(),
    time: new Date().toISOString(),
    apps: ['Exchange Online']
  }
];

async function setupPage(browser, enableRemediation = false) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith('/api/')) {
      if (u.pathname === '/api/status') return route.fulfill({ json: mockStatus });
      if (u.pathname === '/api/dashboard') {
        return route.fulfill({
          json: {
            metrics: { users: 2, priority: 2, mfaMissing: 2, incidents: 2 },
            users: mockUsers,
            incidents: mockIncidents
          }
        });
      }
      return route.fulfill({ json: {} });
    }
    const name = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
    try {
      const body = readFileSync(new URL('../public/' + name, import.meta.url));
      const contentType = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
      return route.fulfill({ body, contentType });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });

  await page.goto('http://localhost:4317/');
  if (enableRemediation) {
    await page.evaluate(() => {
      localStorage.setItem('idsignal_remediation_enabled', 'true');
      location.reload();
    });
    await page.waitForTimeout(400);
  } else {
    await page.evaluate(() => {
      localStorage.removeItem('idsignal_remediation_enabled');
      location.reload();
    });
    await page.waitForTimeout(400);
  }
  return { page, errors };
}

test('UI E2E: Remediation buttons are hidden by default when safety interlock switch is OFF', { skip: !chromeAvailable && 'Chrome kurulu değil' }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { page, errors } = await setupPage(browser, false);
    // User table: no remediation buttons
    const userRemButtons = await page.$$('.remediation-trigger-btn');
    assert.equal(userRemButtons.length, 0, 'Varsayılan olarak kullanıcı tablosunda müdahale butonu gizli olmalı');

    // Attacks page: no incident remediation buttons
    await page.evaluate(() => { location.hash = 'attacks'; });
    await page.waitForTimeout(300);
    const incButtons = await page.$$('.remediation-incident-btn');
    assert.equal(incButtons.length, 0, 'Varsayılan olarak saldırı kartlarında müdahale butonu gizli olmalı');

    // Recommendations page: no remediation buttons
    await page.evaluate(() => { location.hash = 'recommendations'; });
    await page.waitForTimeout(300);
    const recButtons = await page.$$('.remediation-trigger-btn');
    assert.equal(recButtons.length, 0, 'Varsayılan olarak MFA önerilerinde müdahale butonu gizli olmalı');

    assert.deepEqual(errors, [], 'Sayfada JavaScript hatası olmamalı');
  } finally {
    await browser.close();
  }
});

test('UI E2E: Remediation Hub tab renders master switch, collapsible accordions for guides with 3 MFA license tiers, and allows toggling switch', { skip: !chromeAvailable && 'Chrome kurulu değil' }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { page, errors } = await setupPage(browser, false);
    await page.evaluate(() => { location.hash = 'remediation'; });
    await page.waitForTimeout(400);

    const hubContent = await page.evaluate(() => document.getElementById('content').innerText);
    assert.ok(hubContent.includes('Acil Müdahale ve İyileştirme Konsolu'), 'Acil müdahale başlığı bulunmalı');
    assert.ok(hubContent.includes('GÜVENLİK KİLİDİ'), 'Güvenlik kilidi rozeti bulunmalı');
    assert.ok(hubContent.includes('Butonlar GİZLİ'), 'Başlangıçta butonlar gizli durumunda olmalı');
    assert.ok(hubContent.includes('🎯 Acil Müdahale Gerektiren Hedef Hesaplar'), 'Müdahale hedefleri tablosu bulunmalı');

    // Verify vector hexagon SVG in sidebar navigation
    const hasHexIconSvg = await page.$('.sidebar nav .nav-svg-icon');
    assert.ok(hasHexIconSvg, 'Sol menüde vektör heksagon SVG ikonu bulunmalı');

    // Accordions test: both accordions should exist and be collapsed initially
    const accordions = await page.$$('details.remediation-accordion');
    assert.equal(accordions.length, 2, 'İki adet açılır kılavuz akordiyonu bulunmalı');

    const initialOpen = await page.evaluate(() => {
      const accs = document.querySelectorAll('details.remediation-accordion');
      return Array.from(accs).map(a => a.open);
    });
    assert.deepEqual(initialOpen, [false, false], 'Kılavuz akordiyonları başlangıçta kapalı olmalı');

    // Click first accordion summary to expand prerequisites guide
    const summaries = await page.$$('.remediation-accordion-summary');
    await summaries[0].click();
    await page.waitForTimeout(200);

    const firstOpen = await page.evaluate(() => document.querySelectorAll('details.remediation-accordion')[0].open);
    assert.equal(firstOpen, true, 'İlk akordiyona tıklandığında açılmalı');

    const firstBodyText = await page.evaluate(() => document.querySelectorAll('.remediation-accordion-body')[0].innerText);
    assert.ok(firstBodyText.includes('Microsoft Graph Modüllerini Yükleyin'), 'PowerShell ön hazırlık komutları görünmeli');

    // Click second accordion summary to expand MFA methods guide
    await summaries[1].click();
    await page.waitForTimeout(200);

    const secondOpen = await page.evaluate(() => document.querySelectorAll('details.remediation-accordion')[1].open);
    assert.equal(secondOpen, true, 'İkinci akordiyona tıklandığında açılmalı');

    const secondBodyText = await page.evaluate(() => document.querySelectorAll('.remediation-accordion-body')[1].innerText);
    assert.ok(secondBodyText.includes('P1 / P2 GEREKMEZ'), 'TAP ve Per-User için lisans etiketi bulunmalı');
    assert.ok(secondBodyText.includes('ENTRA ID P1 / P2 LİSANSI GEREKİR'), 'Conditional access için lisans etiketi bulunmalı');

    // Click first accordion summary again to verify it collapses
    await summaries[0].click();
    await page.waitForTimeout(200);
    const firstClosedAgain = await page.evaluate(() => document.querySelectorAll('details.remediation-accordion')[0].open);
    assert.equal(firstClosedAgain, false, 'Tekrar tıklandığında ilk akordiyon kapanmalı');

    // Toggle switch to ON via visible slider
    await page.locator('.toggle-slider').click();
    await page.waitForTimeout(300);

    const updatedPill = await page.evaluate(() => document.querySelector('.status-pill').innerText);
    assert.ok(updatedPill.includes('Butonlar AKTİF'), 'Anahtar açıldığında butonlar aktif olmalı');

    // Verify localStorage
    const isStored = await page.evaluate(() => localStorage.getItem('idsignal_remediation_enabled'));
    assert.equal(isStored, 'true', 'Seçim localStorage üzerinde saklanmalı');

    // Now navigate to overview: buttons should now appear
    await page.evaluate(() => { location.hash = 'overview'; });
    await page.waitForTimeout(300);
    const visibleButtons = await page.$$('.remediation-trigger-btn');
    assert.ok(visibleButtons.length >= 2, 'Anahtar açıldıktan sonra kullanıcı tablosunda butonlar görünmeli');

    assert.deepEqual(errors, [], 'Sayfada JavaScript hatası olmamalı');
  } finally {
    await browser.close();
  }
});

test('UI E2E: User table renders remediation button, opens 5-step modal, and copies command to clipboard', { skip: !chromeAvailable && 'Chrome kurulu değil' }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { page, errors } = await setupPage(browser, true);
    const reasonsText = await page.evaluate(() => Array.from(document.querySelectorAll('.table-reason')).map(el => el.innerText).join(' '));
    assert.ok(reasonsText.includes('⊗') || reasonsText.includes('⊘'), 'Kullanıcı tablosunda siber durum sembolleri (⊗ veya ⊘) bulunmalı');

    const remButtons = await page.$$('.remediation-trigger-btn');
    assert.ok(remButtons.length >= 2, 'Kritik hesaplar için en az 2 müdahale butonu bulunmalı');

    await remButtons[0].click();
    await page.waitForTimeout(300);

    const dialogState = await page.evaluate(() => {
      const d = document.getElementById('detail');
      return {
        open: d ? d.open : false,
        text: d ? document.getElementById('detail-body').innerText : ''
      };
    });

    assert.equal(dialogState.open, true, 'Detay modalı açık olmalı');
    assert.ok(dialogState.text.includes('Revoke-MgUserSignInSession'), 'Oturum iptal komutu modalda bulunmalı');
    assert.ok(dialogState.text.includes('ForceChangePasswordNextSignIn'), 'Parola sıfırlama komutu bulunmalı');
    assert.ok(dialogState.text.includes('New-MgUserAuthenticationTemporaryAccessPassMethod'), 'TAP MFA komutu modalda bulunmalı');
    assert.ok(dialogState.text.includes('Add-MgGroupMember'), 'CA Grubu MFA komutu modalda bulunmalı');
    assert.ok(dialogState.text.includes('P1 GEREKMEZ'), 'TAP ve MSOnline lisans etiketi modalda bulunmalı');
    assert.ok(dialogState.text.includes('ENTRA ID P1 / P2 GEREKİR'), 'Conditional access lisans etiketi modalda bulunmalı');
    assert.ok(dialogState.text.includes('$BlockedIPs'), 'Engellenecek IP listesi bulunmalı');

    // Test copy button
    await page.click('.copy-btn');
    await page.waitForTimeout(200);
    const copyText = await page.evaluate(() => document.querySelector('.copy-btn').innerText);
    assert.ok(copyText.includes('Kopyalandı'), 'Kopyalama geri bildirimi verilmeli');

    assert.deepEqual(errors, [], 'Sayfada JavaScript hatası olmamalı');
  } finally {
    await browser.close();
  }
});

test('UI E2E: Attacks page renders incident remediation button and opens Password Spray batch response', { skip: !chromeAvailable && 'Chrome kurulu değil' }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { page, errors } = await setupPage(browser, true);
    await page.evaluate(() => { location.hash = 'attacks'; });
    await page.waitForTimeout(400);

    const incButtons = await page.$$('.remediation-incident-btn');
    assert.ok(incButtons.length >= 2, 'Saldırı kartlarında müdahale butonları bulunmalı');

    // Second incident is the password spray attack
    await incButtons[1].click();
    await page.waitForTimeout(300);

    const dialogState = await page.evaluate(() => {
      const d = document.getElementById('detail');
      return {
        open: d ? d.open : false,
        text: d ? document.getElementById('detail-body').innerText : ''
      };
    });

    assert.equal(dialogState.open, true, 'Olay müdahale modalı açılmalı');
    assert.ok(dialogState.text.includes('Password Spray Çoklu Müdahale Planı'), 'Password spray başlığı bulunmalı');
    assert.ok(dialogState.text.includes('$TargetUsers'), 'Hedef kullanıcı dizisi bulunmalı');
    assert.ok(dialogState.text.includes('203.0.113.55'), 'Saldırgan IP adresi blok listesinde bulunmalı');

    assert.deepEqual(errors, [], 'Sayfada JavaScript hatası olmamalı');
  } finally {
    await browser.close();
  }
});

test('UI E2E: MFA Recommendations table renders remediation button and opens user action modal', { skip: !chromeAvailable && 'Chrome kurulu değil' }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { page, errors } = await setupPage(browser, true);
    await page.evaluate(() => { location.hash = 'recommendations'; });
    await page.waitForTimeout(400);

    const recButtons = await page.$$('.remediation-trigger-btn');
    assert.ok(recButtons.length >= 2, 'MFA önerileri tablosunda yüksek tehditli hesaplarda müdahale butonu bulunmalı');

    await recButtons[0].click();
    await page.waitForTimeout(300);

    const dialogState = await page.evaluate(() => {
      const d = document.getElementById('detail');
      return {
        open: d ? d.open : false,
        text: d ? document.getElementById('detail-body').innerText : ''
      };
    });

    assert.equal(dialogState.open, true, 'MFA öneri müdahale modalı açılmalı');
    assert.ok(dialogState.text.includes('haydogan@nevoto.com.tr'), 'Hedef hesap bilgisi modalda yer almalı');

    assert.deepEqual(errors, [], 'Sayfada JavaScript hatası olmamalı');
  } finally {
    await browser.close();
  }
});

test('UI E2E: User 360 modal allows transition to remediation and back', { skip: !chromeAvailable && 'Chrome kurulu değil' }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { page, errors } = await setupPage(browser, true);
    // Wait for user button and click first one
    await page.waitForSelector('.user-button');
    await page.locator('.user-button').first().click();
    await page.waitForSelector('#detail[open]');

    let text = await page.evaluate(() => document.getElementById('detail-body').innerText);
    assert.ok(text.includes('Kullanıcı incelemesi') || text.includes('Hüseyin Aydoğan'), 'Kullanıcı detay modalı açılmalı');

    // Click remediation trigger from inside user modal
    await page.locator('#detail .remediation-trigger-btn').click();
    await page.waitForTimeout(300);

    text = await page.evaluate(() => document.getElementById('detail-body').innerText);
    assert.ok(text.includes('Acil Müdahale & İyileştirme Planı'), 'Müdahale planı açılmalı');

    // Click back to user profile
    await page.locator('#detail .back-to-user-btn').click();
    await page.waitForTimeout(300);

    text = await page.evaluate(() => document.getElementById('detail-body').innerText);
    assert.ok(text.includes('Kullanıcı incelemesi') || text.includes('Hüseyin Aydoğan'), 'Kullanıcı profiline geri dönülmeli');

    assert.deepEqual(errors, [], 'Sayfada JavaScript hatası olmamalı');
  } finally {
    await browser.close();
  }
});

test('UI E2E: Hardcoded lightning settings CSS variables and 8 themed sidebar hover effects', { skip: !chromeAvailable && 'Chrome kurulu değil' }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { page, errors } = await setupPage(browser, true);
    
    // 1. Check all 8 sidebar items are present with uniform markup
    const expectedKeys = ['overview', 'priority', 'recommendations', 'attacks', 'users', 'remediation', 'sources', 'settings'];
    for (const key of expectedKeys) {
      const link = await page.$(`.sidebar nav a.nav-${key}`);
      assert.ok(link, `Sidebar içinde nav-${key} linki bulunmalı`);
      const iconWrap = await link.$('.nav-icon-wrap');
      assert.ok(iconWrap, `nav-${key} içinde .nav-icon-wrap olmalı`);
      const label = await link.$('.nav-label');
      assert.ok(label, `nav-${key} içinde .nav-label olmalı`);
      const fxLayer = await link.$(`.fx-${key}-layer`);
      assert.ok(fxLayer, `nav-${key} içinde .fx-${key}-layer efekti olmalı`);
    }

    // 2. Verify root CSS variables match requested hardcoded values (-9deg, 3.2s, 0.7 opacity)
    const opacityVal = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lightning-opacity').trim());
    const speedVal = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lightning-speed').trim());
    const angleVal = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lightning-angle').trim());
    
    assert.ok(opacityVal === '0.7' || opacityVal === '0.70', '--lightning-opacity 0.7 veya 0.70 olmalı');
    assert.equal(speedVal, '3.2s', '--lightning-speed 3.2s olmalı');
    assert.equal(angleVal, '-9deg', '--lightning-angle -9deg olmalı');

    // 3. Navigate to settings and ensure live tuning slider panel was removed
    await page.evaluate(() => { location.hash = 'settings'; });
    await page.waitForTimeout(300);
    const settingsPanel = await page.$('.lightning-settings-panel');
    assert.equal(settingsPanel, null, 'Ayarlar sayfasında ayar çekmeli paneli olmamalı');

    assert.deepEqual(errors, [], 'Sayfada JavaScript hatası olmamalı');
  } finally {
    await browser.close();
  }
});

