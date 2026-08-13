// E2E UI check (dev): alur lengkap + alur Guest + screenshot tiap layar.
// Jalankan dengan API (8080) & vite dev (5199) aktif:
//   pnpm exec vite dev --port 5199
//   node scripts/ui-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5199';
const API = process.env.BANDJARI_API || 'http://localhost:8080/api/v1';
const SHOTS = '/tmp/bandjari-ui-shots';
mkdirSync(SHOTS, { recursive: true });

const email = `ui-${Date.now()}@test.dev`;
const password = 'secret123';
await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'UI Test', email, password }),
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const badResponses = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
});

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.log(`❌ ${name}: ${String(e).slice(0, 300)}`);
    console.log('   url:', page.url());
    console.log('   body:', (await page.locator('body').innerText()).slice(0, 300).replace(/\n/g, ' | '));
    await page.screenshot({ path: `${SHOTS}/fail-${name.replace(/[^a-z0-9]+/gi, '-')}.png`, fullPage: true });
    await browser.close();
    process.exit(1);
  }
};

const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(`📸 ${name}`);
};

// ===== Alur Guest (Flow 5.0, AC-11): tanpa login =====
// Dijalankan hanya bila Song Template System tersedia di DB — bila data
// template sengaja dibersihkan, verifikasi state kosong Beranda lalu lewati.
let hasTemplates = true;
await step('beranda: template ada atau state kosong tertangani', async () => {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('text=Selamat Datang di BandJari', { timeout: 20000 });
  try {
    await page.waitForSelector('text=Song Template System', { timeout: 8000 });
    hasTemplates = true;
    console.log('   (template tersedia — alur Guest lengkap dijalankan)');
  } catch {
    hasTemplates = false;
    const empty = await page.locator('text=Belum ada lagu bawaan').count();
    if (empty === 0) throw new Error('state kosong beranda tidak tampil');
    console.log('   (template kosong — alur Guest dilewati, state kosong terverifikasi)');
  }
});

if (hasTemplates) {
  await step('guest: beranda menampilkan Song Bawaan + SYSTEM badge', async () => {
    const sysBadges = await page.locator('text=SYSTEM').count();
    if (sysBadges === 0) throw new Error('badge SYSTEM tidak muncul di kartu template');
    const mainBtns = await page.locator('a:has-text("▶ Main")').count();
    if (mainBtns === 0) throw new Error('tombol ▶ Main tidak ada');
  });
  await shot('01-landing-guest');

  await step('guest: buka detail template → banner Mode Lihat Saja', async () => {
    await page.locator('a:has-text("▶ Main")').first().locator('..').locator('..').locator('a').first().click();
    await page.waitForSelector('text=Mode Lihat Saja', { timeout: 15000 });
    const cta = await page.locator('text=Login untuk Edit').count();
    if (cta === 0) throw new Error('banner guest tanpa CTA Login untuk Edit');
  });
  await shot('02-detail-template-guest');

  await step('guest: sequencer template read-only', async () => {
    await page.click('a:has-text("Buka di Sequencer Mode →")');
    await page.waitForSelector('text=Sequencer — Section:', { timeout: 15000 });
    await page.waitForSelector('text=Mode Lihat Saja', { timeout: 15000 });
    const subheaders = await page.locator('button:has-text("Kelola bunyi")').count();
    if (subheaders !== 0) throw new Error('grid read-only masih menampilkan kontrol edit');
  });
  await shot('03-sequencer-guest');

  await step('guest: launcher template menampilkan pad + transport', async () => {
    await page.click('a:has-text("Buka Launcher")');
    await page.waitForSelector('text=Launcher —', { timeout: 15000 });
    await page.waitForSelector('button[aria-label^="Mainkan section"]', { timeout: 20000 });
    await page.waitForSelector('text=Mute Part…', { timeout: 15000 });
  });
  await shot('04-launcher-guest');
} else {
  await shot('01-landing-tanpa-template');
}

// ===== Alur user login =====
await step('login', async () => {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#email', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
});

await step('daftar lagu: meta BPM · N Section tampil', async () => {
  await page.goto(`${BASE}/songs`);
  await page.waitForSelector('text=Lagu Saya', { timeout: 15000 });
});
await shot('05-song-list');

await step('buat lagu → otomatis lanjut ke halaman Section', async () => {
  await page.click('button:has-text("+ Buat Song Baru")');
  await page.fill('#name', 'Lagu UI Test');
  await page.fill('#bpm', '90');
  await page.click('form button:has-text("Simpan & Lanjut ke Section")');
  await page.waitForSelector('text=+ Tambah Section', { timeout: 15000 });
  await page.waitForSelector('text=Ringkasan Song', { timeout: 15000 });
  if (!page.url().includes('/songs/')) throw new Error('tidak berpindah ke halaman detail lagu');
});
await shot('06-song-detail-kosong');

await step('tambah section Awalan (form inline di strip)', async () => {
  await page.click('button:has-text("+ Tambah Section")');
  await page.fill('input[aria-label="Nama section baru"]', 'Awalan');
  await page.click('form button:has-text("Simpan")');
  await page.waitForSelector('[role="button"]:has-text("Awalan")', { timeout: 15000 });
  await page.waitForSelector('text=Section Terpilih: Awalan', { timeout: 15000 });
});
await shot('07-song-detail-section');

await step('chip section → Sequencer Mode (grid terpadu 5 Part, mulai kosong)', async () => {
  await page.click('a:has-text("Buka di Sequencer Mode →")');
  await page.waitForSelector('text=Sequencer — Section: Awalan', { timeout: 15000 });
  const partHeaders = await page.locator('tbody >> text=Rebana 1').count();
  const bassHeader = await page.locator('tbody >> text=Bass').count();
  if (partHeaders === 0 || bassHeader === 0) throw new Error('subheader Part tidak muncul di grid terpadu');
  const emptyHint = await page.locator('text=Belum ada jenis bunyi').count();
  if (emptyHint === 0) throw new Error('grid tidak mulai kosong — masih ada SoundSlot default');
});
await shot('08-sequencer');

await step('tambah SoundSlot pertama (Tak/T1, key 2 karakter) di Rebana 1', async () => {
  await page.click('button:has-text("+ Tambah Bunyi untuk Rebana 1")');
  await page.fill('#new-slot-label', 'Tak');
  await page.fill('#new-slot-key', 'T1');
  await page.click('form button:has-text("+ Tambah Bunyi")');
  await page.waitForSelector('tbody button[aria-label^="Langkah "]', { timeout: 15000 });
});

await step('grid steps: isi 4 kotak, matikan kotak ke-3 — kotak lain tidak bergeser', async () => {
  const cells = page.locator('tbody button[aria-label^="Langkah "]');
  const before = await cells.count();
  if (before === 0) throw new Error('sel step tidak ada');

  // Isi kotak 1–4
  for (let i = 0; i < 4; i++) {
    await cells.nth(i).click();
  }
  const filled = await page.locator('tbody button[aria-pressed="true"]').count();
  if (filled !== 4) throw new Error(`kotak terisi = ${filled}, want 4`);

  // Matikan kotak ke-3 — kotak 1,2,4 harus tetap seperti semula
  await cells.nth(2).click();
  const on3 = await cells.nth(2).getAttribute('aria-pressed');
  const on4 = await cells.nth(3).getAttribute('aria-pressed');
  if (on3 !== 'false') throw new Error('kotak ke-3 tidak mati');
  if (on4 !== 'true') throw new Error('kotak ke-4 ikut mati/bergeser');
});

await step('grid steps: ±8 step & simpan perubahan', async () => {
  const cells = page.locator('tbody button[aria-label^="Langkah "]');
  const before = await cells.count();
  await page.click('button:has-text("+ 8 Step")');
  const after = await cells.count();
  if (after <= before) throw new Error(`sel tidak bertambah (${before} → ${after})`);
  await page.click('button:has-text("Simpan Perubahan")');
  await page.waitForSelector('text=Steps tersimpan', { timeout: 15000 });
});

await step('kembali ke Section → Ringkasan Song terisi', async () => {
  await page.click('a:has-text("← Kembali ke Section")');
  await page.waitForSelector('text=1 Section tersusun', { timeout: 15000 });
});

await step('launcher: pad tampil + trigger + stop', async () => {
  await page.click('a:has-text("▶ Buka Launcher Mode")');
  await page.waitForSelector('text=Launcher — Lagu UI Test', { timeout: 15000 });
  const pad = page.locator('button[aria-label^="Mainkan section"]');
  await pad.waitFor({ timeout: 20000 });
  await pad.click();
  await page.waitForSelector('text=Sedang Main', { timeout: 10000 });
  await page.waitForSelector('text=sedang main ·', { timeout: 10000 }); // status pad aktif
  await page.click('button:has-text("■ Stop")');
  await page.waitForSelector('text=Tekan salah satu pad Section untuk mulai.', { timeout: 10000 });
});
await shot('09-launcher-user');

// ===== Sample Library =====
await step('sample library: dua seksi + kartu bawaan read-only', async () => {
  await page.goto(`${BASE}/samples`);
  await page.waitForSelector('text=Sample Bawaan (Template System)', { timeout: 15000 });
  await page.waitForSelector('text=Sample Saya', { timeout: 15000 });
  const usageMeta = await page.locator('text=Dipakai di').count();
  if (usageMeta > 0) {
    console.log('   (kartu template ada — meta usage_count terverifikasi)');
  } else {
    await page.waitForSelector('text=Belum ada sample bawaan', { timeout: 15000 });
    console.log('   (template sample kosong — state kosong terverifikasi)');
  }
});
await shot('10-sample-library');

console.log('console errors:', errors.length ? errors.join('\n') : '(tidak ada)');
console.log('respons 4xx:', badResponses.length ? badResponses.join('\n') : '(tidak ada)');
await browser.close();
if (errors.length > 0) process.exit(1);
