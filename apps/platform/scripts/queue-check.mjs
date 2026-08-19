// E2E check Launcher: MODE BIASA (default, pra-antrian) vs MODE ANTRIAN (aktif
// bila antrian tidak kosong — dipicu tombol +). Meliputi: pending single-slot,
// auto-append tujuan lanjut (mode antrian), dedup, badge pill multi-posisi,
// panel antrian (stepper, reorder, hapus, bersihkan), queue-first, Play/Pause/Stop.
// Jalankan dengan API (8080) & vite dev (3000):
//   node scripts/queue-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const SHOTS = '/tmp/bandjari-queue-shots';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
    console.log(`❌ ${name}: ${String(e).slice(0, 400)}`);
    console.log('   url:', page.url());
    console.log('   body:', (await page.locator('body').innerText()).slice(0, 400).replace(/\n/g, ' | '));
    await page.screenshot({ path: `${SHOTS}/fail.png`, fullPage: true });
    process.exit(1);
  }
};

const shot = async (name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(`📸 ${name}`);
};

const waitFor = async (fn, timeout = 15000, interval = 200) => {
  const s = Date.now();
  while (Date.now() - s < timeout) {
    if (await fn()) return;
    await page.waitForTimeout(interval);
  }
  throw new Error('timeout menunggu kondisi');
};

const padBtn = (name) => page.locator(`button[aria-label="Mainkan section ${name}"]`);
const padSub = async (name) => padBtn(name).locator('span').nth(1).innerText().catch(() => '');
const queueBtn = (name) => padBtn(name).locator('xpath=..').locator('button[aria-label^="Tambahkan"]');
/** Badge pill nomor antrian (semua posisi dipisah |) di pojok pad. */
const queueBadge = (name) => padBtn(name).locator('xpath=..').locator('span[data-queue-positions]');
const queueCount = async () => {
  const t = await page.locator('button[aria-label^="Antrian"]').innerText();
  const m = t.match(/\((\d+)\)/);
  return m ? Number(m[1]) : -1;
};
const modeBadge = () => page.locator('div[aria-live="polite"] span').first().innerText();

let names = [];
await step('buka Launcher template (guest)', async () => {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('text=Song Template System', { timeout: 20000 });
  await page.locator('a:has-text("▶ Main")').first().click();
  await page.waitForSelector('button[aria-label^="Mainkan section"]', { timeout: 20000 });
  names = await page.locator('button[aria-label^="Mainkan section"]').evaluateAll((bs) =>
    bs.map((b) => b.getAttribute('aria-label').replace('Mainkan section ', '')),
  );
  console.log('   sections:', names.join(', '));
});
await shot('01-launcher');

await step('default = MODE BIASA + tiap pad punya tombol +', async () => {
  if ((await modeBadge()) !== 'Mode Biasa') throw new Error(`mode awal bukan Biasa: ${await modeBadge()}`);
  const pads = await page.locator('button[aria-label^="Mainkan section"]').count();
  const qbtns = await page.locator('button[aria-label^="Tambahkan"]').count();
  if (qbtns !== pads) throw new Error(`tombol + ${qbtns} ≠ jumlah pad ${pads}`);
});

const bpmValue = async () => Number((await page.locator('span[data-bpm-value]').innerText()).replace(' BPM', ''));

await step('kontrol BPM: stepper ±1/±5 + reset (idle)', async () => {
  if ((await bpmValue()) !== 90) throw new Error(`BPM awal = ${await bpmValue()}, harap 90`);
  await page.click('button[aria-label="Tambah 5 BPM"]');
  await waitFor(async () => (await bpmValue()) === 95);
  await page.click('button[aria-label="Kurangi 1 BPM"]');
  await waitFor(async () => (await bpmValue()) === 94);
  await page.click('button[aria-label="Reset BPM ke BPM asli Song"]');
  await waitFor(async () => (await bpmValue()) === 90);
  // Clamp bawah: klik −5 berulang sampai menyentuh batas 20, tombol − jadi disabled.
  for (let i = 0; i < 20 && (await bpmValue()) > 20; i++) {
    await page.click('button[aria-label="Kurangi 5 BPM"]');
  }
  await waitFor(async () => (await bpmValue()) === 20);
  if (!(await page.locator('button[aria-label="Kurangi 5 BPM"]').isDisabled())) throw new Error('tombol −5 tidak disabled di batas bawah');
  await page.click('button[aria-label="Reset BPM ke BPM asli Song"]');
  await waitFor(async () => (await bpmValue()) === 90);
});

await step('MODE BIASA: mainkan section[0] → auto-advance TANPA mengisi antrian', async () => {
  await padBtn(names[0]).click();
  await waitFor(async () => (await page.locator('text=Sedang Main').count()) > 0);
  // Rantai "sekali" berjalan (awalan → awal dasaran → dasar) tapi antrian tetap 0.
  await waitFor(async () => (await padSub(names[2])).includes('sedang main'), 20000);
  if ((await queueCount()) !== 0) throw new Error(`antrian terisi di mode biasa: ${await queueCount()}`);
  if ((await modeBadge()) !== 'Mode Biasa') throw new Error('mode berubah tanpa tombol +');
  await page.click('button:has-text("Stop")');
});
await shot('02-normal-auto-advance');

await step('MODE BIASA: klik pad lain saat main → pending single-slot, BUKAN antrian', async () => {
  await padBtn(names[2]).click(); // dasar (loop) mulai
  await waitFor(async () => (await padSub(names[2])).includes('sedang main'));
  await padBtn(names[3]).click(); // pilih berikutnya — mode biasa
  await waitFor(async () => (await padSub(names[3])).includes('menunggu akhir siklus'), 5000);
  if ((await queueCount()) !== 0) throw new Error(`pending masuk antrian: ${await queueCount()}`);
  if ((await queueBadge(names[3]).count()) !== 0) throw new Error('pad pending menampilkan badge antrian');
  if ((await modeBadge()) !== 'Mode Biasa') throw new Error('mode bukan Biasa saat pending');
  await page.click('button:has-text("Stop")');
});
await shot('03-normal-pending');

await step('tombol + pertama → MODE ANTRIAN aktif (badge + nomor urut)', async () => {
  await queueBtn(names[1]).click();
  await waitFor(async () => (await queueCount()) === 1);
  if ((await modeBadge()) !== 'Mode Antrian') throw new Error(`mode bukan Antrian: ${await modeBadge()}`);
  if ((await queueBadge(names[1]).innerText()) !== '1') throw new Error('badge posisi 1 tidak tampil');
  await queueBtn(names[2]).click();
  await waitFor(async () => (await queueCount()) === 2);
  if ((await queueBadge(names[2]).innerText()) !== '2') throw new Error('badge posisi 2 tidak tampil');
});
await shot('04-mode-antrian');

await step('MODE ANTRIAN: klik pad lain saat main → append di AKHIR antrian', async () => {
  await padBtn(names[1]).click(); // awal dasaran (sekali) mulai
  await waitFor(async () => (await padSub(names[2])).includes('sedang main'), 15000); // dasar ∞ menahan
  await padBtn(names[4]).click(); // naik — append
  await waitFor(async () => (await padSub(names[4])).includes('menunggu akhir siklus'), 5000);
  const badge = await queueBadge(names[4]).innerText();
  if (badge !== '3') throw new Error(`badge pad ${names[4]} = ${badge}, harap 3`);
});
await shot('05-mode-antrian-append');

await step('BPM realtime saat main: +5 langsung berlaku di section aktif', async () => {
  await page.click('button[aria-label="Tambah 5 BPM"]');
  await waitFor(async () => (await padSub(names[2])).includes('95 BPM'), 5000);
  await page.click('button[aria-label="Reset BPM ke BPM asli Song"]');
  await waitFor(async () => (await padSub(names[2])).includes('90 BPM'), 5000);
});

await step('panel antrian: baris terisi, stepper loop (∞ → 8)', async () => {
  await page.click('button[aria-label^="Antrian"]');
  await page.waitForSelector('aside[aria-label="Daftar antrian"]', { timeout: 5000 });
  const rows = await page.locator('aside li').count();
  if (rows < 3) throw new Error(`baris antrian = ${rows}, harap ≥ 3`);
  const infIndex = await page.locator('aside li').evaluateAll((lis) =>
    lis.findIndex((li) => li.textContent?.includes('∞')),
  );
  if (infIndex < 0) throw new Error('tidak ada baris loop ∞');
  await page.locator('aside li').nth(infIndex).locator('button[aria-label^="Kurangi jumlah loop"]').click();
  await waitFor(async () => (await page.locator('aside li').nth(infIndex).locator('span[title^="Loop"]').innerText().catch(() => '')) === '8', 5000);
});
await shot('06-panel');

await step('drag-drop reorder baris antrian', async () => {
  const rows = page.locator('aside li');
  const first = (await rows.first().locator('p').first().innerText()).trim();
  const last = (await rows.last().locator('p').first().innerText()).trim();
  await rows.last().dragTo(rows.first());
  await waitFor(async () => (await page.locator('aside li').first().locator('p').first().innerText().catch(() => '')) === last, 5000);
  console.log(`   urutan: [${first}, ..., ${last}] → [${last}, ...]`);
});
await shot('07-reorder');

await step('hapus baris via ✕ → daftar berkurang', async () => {
  const before = await page.locator('aside li').count();
  await page.locator('aside li').last().locator('button[aria-label^="Hapus"]').click();
  await waitFor(async () => (await page.locator('aside li').count()) === before - 1, 5000);
});

await step('queue-first: akhir siklus pindah ke baris antrian (pad bermain punya badge)', async () => {
  await page.click('button[aria-label="Tutup daftar antrian"]');
  await waitFor(async () => {
    const playing = page.locator('button[aria-label^="Mainkan section"]').filter({ hasText: 'sedang main' }).first();
    if ((await playing.count()) === 0) return false;
    const name = (await playing.getAttribute('aria-label')).replace('Mainkan section ', '');
    return (await queueBadge(name).innerText().catch(() => '')) !== '';
  }, 20000);
  const name = (await page
    .locator('button[aria-label^="Mainkan section"]')
    .filter({ hasText: 'sedang main' })
    .first()
    .getAttribute('aria-label')).replace('Mainkan section ', '');
  console.log(`   bermain dari antrian: ${name}`);
});

await step('stop → antrian tetap utuh', async () => {
  await page.click('button:has-text("Stop")');
  if ((await queueCount()) < 1) throw new Error('antrian hilang setelah stop');
});

await step('badge pill menampilkan SEMUA posisi dipisah | (section di-antre >1 kali)', async () => {
  let target = null;
  for (const n of names) {
    if ((await queueBadge(n).count()) === 0) {
      target = n;
      break;
    }
  }
  if (!target) throw new Error('semua section sudah di antrian');
  await queueBtn(target).click();
  await queueBtn(target).click();
  await waitFor(async () => (await queueBadge(target).innerText().catch(() => '')) !== '', 5000);
  const badge = await queueBadge(target).innerText();
  if (!/^\d+\|\d+$/.test(badge)) throw new Error(`badge multi-posisi salah: ${badge}`);
  const btnText = await queueBtn(target).innerText().catch(() => '');
  if (/\d/.test(btnText)) throw new Error(`tombol + berisi nomor: ${btnText}`);
  console.log(`   badge ${target} = ${badge}`);
});
await shot('08-multi-badge');

await step('tombol Play dengan antrian berisi → mulai dari baris antrian', async () => {
  await page.click('button:has-text("Play")');
  await waitFor(async () => (await page.locator('text=Sedang Main').count()) > 0, 10000);
  const playing = page.locator('button[aria-label^="Mainkan section"]').filter({ hasText: 'sedang main' }).first();
  const name = (await playing.getAttribute('aria-label')).replace('Mainkan section ', '');
  if ((await queueBadge(name).innerText().catch(() => '')) === '') throw new Error(`pad main (${name}) tanpa badge`);
  console.log(`   mulai dari antrian: ${name}`);
});

await step('tombol Pause → tombol pause terkunci, Play aktif untuk resume', async () => {
  await page.click('button:has-text("Pause")');
  await waitFor(async () => (await page.locator('button:has-text("Pause")').isDisabled()) === true, 5000);
  if (!(await page.locator('button:has-text("Play")').isEnabled())) throw new Error('Play tidak aktif saat pause');
});
await shot('09-pause');

await step('tombol Play saat pause → resume (Pause aktif kembali)', async () => {
  await page.click('button:has-text("Play")');
  await waitFor(async () => (await page.locator('button:has-text("Pause")').isEnabled()) === true, 5000);
});

await step('BERSIHKAN antrian → kembali MODE BIASA (antrian < 1 = nonaktif)', async () => {
  await page.click('button:has-text("Stop")');
  await page.click('button[aria-label^="Antrian"]');
  await page.waitForSelector('aside[aria-label="Daftar antrian"]', { timeout: 5000 });
  await page.click('button:has-text("Bersihkan")');
  await waitFor(async () => (await queueCount()) === 0, 5000);
  await page.click('button[aria-label="Tutup daftar antrian"]');
  if ((await modeBadge()) !== 'Mode Biasa') throw new Error(`mode belum kembali Biasa: ${await modeBadge()}`);
  const badges = await page.locator('span[data-queue-positions]').count();
  if (badges !== 0) throw new Error(`badge masih tampil setelah bersihkan: ${badges}`);
});
await shot('10-clear');

await step('tombol Play tanpa antrian (mode biasa) → mulai dari section urutan PERTAMA', async () => {
  await page.click('button:has-text("Play")');
  await waitFor(async () => (await padSub(names[0])).includes('sedang main'), 10000);
  await page.click('button:has-text("Stop")');
});

await step('mobile: panel antrian tampil sebagai bottom sheet', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  // Header mobile: judul kecil di tengah, back ikon kiri, subtitle → ikon info kanan.
  const titleBox = await page.locator('h1').first().boundingBox();
  if (!titleBox) throw new Error('judul tidak terlihat');
  const titleCenter = titleBox.x + titleBox.width / 2;
  if (Math.abs(titleCenter - 195) > 60) throw new Error(`judul tidak di tengah: center=${titleCenter.toFixed(0)}`);
  if ((await page.locator('p:has-text("Tekan pad untuk loop")').isVisible().catch(() => false))) {
    throw new Error('subtitle masih terlihat di mobile');
  }
  // Subtitle → ikon info yang bisa DIKLIK (popover), bukan hover tooltip.
  const infoBtn = page.locator('button[aria-label^="Tekan pad untuk loop"]').first();
  if (!(await infoBtn.isVisible().catch(() => false))) throw new Error('ikon info tidak ada');
  await infoBtn.click();
  await waitFor(async () => {
    const txt = await page.locator('div[role="dialog"] p').first().innerText().catch(() => '');
    return txt.includes('quantized trigger');
  }, 5000);
  await page.mouse.click(10, 400); // klik di luar → tutup
  await waitFor(async () => (await page.locator('div[role="dialog"]').count()) === 0, 5000);
  console.log('   popover info: klik buka → klik luar tutup OK');
  // Hint idle transport: teks disembunyikan, ikon popover di KANAN (tidak menggantikan info BPM).
  if ((await page.locator('p:has-text("Tekan ▶ Play")').isVisible().catch(() => false))) {
    throw new Error('teks hint idle masih terlihat di mobile');
  }
  const hintBtn = page.locator('button[aria-label^="Tekan ▶ Play"]').first();
  if (!(await hintBtn.isVisible().catch(() => false))) throw new Error('ikon hint transport tidak ada');
  const hintBox = await hintBtn.boundingBox();
  if (!hintBox || hintBox.x < 250) throw new Error(`ikon hint tidak di kanan: x=${hintBox?.x}`);
  if ((await page.locator('span[data-bpm-value]').count()) !== 1) throw new Error('info BPM hilang');
  console.log('   status mobile minimal [Mode | ℹ] — tanpa duplikasi BPM');
  await hintBtn.click();
  await waitFor(async () => {
    const txt = await page.locator('div[role="dialog"] p').first().innerText().catch(() => '');
    return txt.includes('mulai per antrian');
  }, 5000);
  await page.mouse.click(10, 400); // tutup lagi
  await waitFor(async () => (await page.locator('div[role="dialog"]').count()) === 0, 5000);
  console.log('   hint transport: ikon kanan + popover klik OK');
  // Saat playing di mobile: teks status disembunyikan (info ada di pad), ikon hint tetap di kanan.
  await page.click('button[aria-label="Play"]');
  await waitFor(async () => (await page.locator('button[aria-label^="Mainkan section"]').filter({ hasText: 'sedang main' }).count()) > 0, 10000);
  if ((await page.locator('p:has-text("Sedang Main")').count()) !== 0) {
    throw new Error('teks status playing masih ada di mobile');
  }
  if (!(await hintBtn.isVisible().catch(() => false))) throw new Error('ikon hint hilang saat playing');
  await page.click('button[aria-label="Stop"]');
  console.log('   saat playing: status disembunyikan, ikon hint tetap di kanan');
  if (!(await page.locator('a[aria-label="Kembali ke lagu"] svg').first().isVisible().catch(() => false))) {
    throw new Error('back ikon tidak terlihat');
  }
  console.log(`   judul center=${titleCenter.toFixed(0)}px, back ikon + info tooltip OK`);
  // Header mobile sticky top: scroll ke bawah, bar tetap menempel di atas.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  const stickyY = (await page.locator('h1').first().boundingBox())?.y ?? -1;
  if (stickyY > 12) throw new Error(`header tidak sticky: y=${stickyY}`);
  // Transport bar ikut sticky — menempel tepat di bawah header (top-10 = 40px).
  const transportY = (await page.locator('[data-transport-bar]').boundingBox())?.y ?? -1;
  if (Math.abs(transportY - 40) > 6) throw new Error(`transport tidak sticky: y=${transportY}`);
  console.log(`   header sticky top: y=${stickyY.toFixed(0)}px, transport sticky: y=${transportY.toFixed(0)}px`);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Kontrol BPM: baris berbeda dari tombol play & posisinya di tengah.
  const bpmBox = await page.locator('span[data-bpm-value]').boundingBox();
  const playBox = await page.locator('button[aria-label="Play"]').boundingBox();
  if (!bpmBox || !playBox) throw new Error('kontrol BPM/Play tidak terlihat');
  if (Math.abs(bpmBox.y - playBox.y) < 20) throw new Error(`BPM masih sebaris play: bpm.y=${bpmBox.y}, play.y=${playBox.y}`);
  const bpmCenter = bpmBox.x + bpmBox.width / 2;
  if (Math.abs(bpmCenter - 195) > 60) throw new Error(`BPM tidak di tengah: center=${bpmCenter.toFixed(0)}`);
  // Grup kontrol play juga terpusat (center kelompok = tengah viewport).
  const leftBox = await page.locator('button[aria-label^="Antrian"]').boundingBox();
  const muteBox = await page.locator('summary').boundingBox();
  if (!leftBox || !muteBox) throw new Error('grup play tidak terlihat');
  const groupCenter = (leftBox.x + muteBox.x + muteBox.width) / 2;
  if (Math.abs(groupCenter - 195) > 60) throw new Error(`grup play tidak di tengah: center=${groupCenter.toFixed(0)}`);
  console.log(`   BPM baris sendiri (center=${bpmCenter.toFixed(0)}px), grup play terpusat (center=${groupCenter.toFixed(0)}px)`);
  await page.click('button[aria-label^="Antrian"]');
  await page.waitForSelector('aside[aria-label="Daftar antrian"]', { timeout: 5000 });
  const box = await page.locator('aside[aria-label="Daftar antrian"]').boundingBox();
  if (!box || box.y + box.height < 830) throw new Error(`bukan bottom sheet: ${JSON.stringify(box)}`);
});
await shot('11-mobile-sheet');

if (errors.length > 0) {
  console.log('⚠️  Console/page errors:', errors.slice(0, 5));
} else {
  console.log('✅ Tidak ada console error');
}

await browser.close();
console.log('SELESAI — screenshot di', SHOTS);
