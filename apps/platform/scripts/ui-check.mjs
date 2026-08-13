// E2E UI check (dev): login → buat lagu → kelola section → sequencer → launcher.
// Jalankan dengan API (8080) & vite dev (5199) aktif:
//   pnpm exec vite dev --port 5199
//   node scripts/ui-check.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:5199';
const API = 'http://localhost:8080/api/v1';

const email = `ui-${Date.now()}@test.dev`;
const password = 'secret123';
await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'UI Test', email, password }),
});

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.log(`❌ ${name}: ${String(e).slice(0, 200)}`);
    console.log('   url:', page.url());
    console.log('   body:', (await page.locator('body').innerText()).slice(0, 200).replace(/\n/g, ' | '));
    await browser.close();
    process.exit(1);
  }
};

await step('login', async () => {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#email', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
});

await step('buat lagu', async () => {
  await page.goto(`${BASE}/songs`);
  await page.click('button:has-text("+ Buat Lagu Baru")');
  await page.fill('#name', 'Lagu UI Test');
  await page.fill('#bpm', '90');
  await page.click('form button:has-text("Buat")');
  await page.waitForSelector('text=Lagu UI Test', { timeout: 15000 });
});

await step('klik nama lagu → halaman kelola', async () => {
  await page.click('a:has-text("Lagu UI Test")');
  await page.waitForSelector('text=+ Tambah Section', { timeout: 15000 });
});

await step('tambah section Awalan', async () => {
  await page.fill('#new-section', 'Awalan');
  await page.click('button:has-text("+ Tambah Section")');
  await page.waitForSelector('a:has-text("Awalan")', { timeout: 15000 });
});

await step('klik chip section → Sequencer Mode', async () => {
  await page.click('a:has-text("Awalan")');
  await page.waitForSelector('text=Sequencer Mode', { timeout: 15000 });
  const tabs = await page.locator('role=tab').count();
  if (tabs !== 5) throw new Error(`tab part = ${tabs}, want 5`);
});

await step('grid steps: tambah langkah & simpan', async () => {
  await page.click('button[title="Tambah langkah di akhir"]');
  const cells = await page.locator('[aria-label^="Langkah"]').count();
  if (cells === 0) throw new Error('grid steps tidak bertambah');
  console.log(`   (grid cells: ${cells})`);
  await page.click('button:has-text("Simpan Steps")');
  await page.waitForSelector('text=Steps tersimpan', { timeout: 15000 });
});

await step('Buka Launcher → pad section tampil', async () => {
  await page.click('a:has-text("Buka Launcher")');
  await page.waitForSelector('text=Launcher Mode', { timeout: 15000 });
  await page.waitForSelector('text=Awalan', { timeout: 20000 }); // pad muncul setelah audio siap
  const pads = await page.locator('button[aria-label^="Mainkan section"]').count();
  if (pads === 0) throw new Error('pad section tidak muncul');
  console.log(`   (pad: ${pads})`);
});

console.log('console errors:', errors.length ? errors.join('\n') : '(tidak ada)');
await browser.close();
