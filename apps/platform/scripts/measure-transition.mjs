// Ukur presisi quantized trigger di Launcher: pindah section harus jatuh TEPAT
// di batas siklus section lama (bukan lebih awal ~lookahead).
import { chromium } from 'playwright';

const API = process.env.BANDJARI_API || 'http://localhost:8080/api/v1';
const BASE = process.env.BANDJARI_BASE || 'http://localhost:3000';
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFuYXNAYmFuZGphcmkuY29tIiwiZXhwIjoxNzg2NzE3NDE0LCJ1c2VyX2lkIjoyfQ.XTQuLKkLSKfw_GMaiTuMXP0dmdgTXPJOCnNSrAlk6YU';

const api = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...(opts.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
};

// Siapkan lagu uji: 2 section (8 langkah T tiap part), A=90, B override 120.
const song = (await api('/songs', { method: 'POST', body: JSON.stringify({ name: '__uji_trans__', bpm: 90 }) })).data;
const secA = (await api(`/songs/${song.id}/sections`, { method: 'POST', body: JSON.stringify({ name: 'A' }) })).data;
const secB = (await api(`/songs/${song.id}/sections`, { method: 'POST', body: JSON.stringify({ name: 'B' }) })).data;
for (const sec of [secA, secB]) {
  const parts = (await api(`/sections/${sec.id}/parts`)).data;
  const r1 = parts.find((p) => p.part === 'rebana1');
  await api(`/section-parts/${r1.id}/sound-slots`, { method: 'POST', body: JSON.stringify({ label: 'Tak', key: 'T' }) });
  await api(`/section-parts/${r1.id}`, {
    method: 'PUT',
    body: JSON.stringify({ steps: { set: true, value: 'T,.,.,.,.,.,.,.' } }),
  });
}
await api(`/sections/${secB.id}`, { method: 'PUT', body: JSON.stringify({ bpm_override: { set: true, value: 120 } }) });

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.addInitScript((t) => localStorage.setItem('token', t), TOKEN);
await page.goto(`${BASE}/songs/${song.id}/play`);
await page.waitForSelector('button[aria-label^="Mainkan section"]', { timeout: 20000 });

// Mulai A; rekam timestamp tiap awal siklus (indikator reset ke 1). Setelah
// ~1,5 dtk picu B (pending) dan ukur kapan status berpindah ke B.
await page.click('button[aria-label^="Mainkan section"] >> nth=0');
await page.waitForSelector('span.sr-only', { timeout: 5000 });

const boundaries = [];
let lastStep = null;
let triggerAt = null;
let switchAt = null;
const startAt = Date.now();
while (Date.now() - startAt < 5000) {
  const now = Date.now();
  // Satu round-trip per iterasi (bukan dua) agar sampling cukup rapat & stabil.
  const snap = await page.evaluate(() => {
    const sr = document.querySelector('button[aria-label^="Mainkan section"] span.sr-only');
    const statusEl = Array.from(document.querySelectorAll('div[aria-live="polite"]')).find((d) =>
      (d.textContent ?? '').includes('Sedang Main'),
    );
    return { step: sr?.textContent ?? null, status: statusEl?.textContent ?? '' };
  });
  if (snap.step && snap.step !== lastStep) {
    if (snap.step.includes('1 dari')) boundaries.push(now);
    lastStep = snap.step;
  }
  if (triggerAt === null && now - startAt > 1500) {
    triggerAt = now;
    await page.click('button[aria-label^="Mainkan section"] >> nth=1');
  }
  if (switchAt === null && triggerAt !== null && snap.status.includes('B —')) {
    switchAt = now;
  }
  await page.waitForTimeout(5);
}
if (boundaries.length < 2) throw new Error(`siklus terdeteksi ${boundaries.length}, kurang data. console: ${errors.join(' | ').slice(0, 200)}`);
if (switchAt === null) throw new Error('transisi ke B tidak terdeteksi');

console.log(`boundaries: ${boundaries.map((t) => Math.round(t - startAt)).join(', ')} ms (relatif awal)`);
const intervals = boundaries.slice(1).map((t, i) => t - boundaries[i]);
console.log(`interval antar siklus: ${intervals.map((v) => Math.round(v)).join(', ')} ms`);
const cycleA = intervals[0] ?? NaN;
console.log(`siklus A terukur ${cycleA} ms (harapan 8 × 166,7 = 1333)`);

// Batas siklus pertama SETELAH trigger B adalah titik transisi yang benar.
const nextBoundary = boundaries.find((t) => t > triggerAt);
const delta = switchAt - nextBoundary;
console.log(`transisi terdeteksi ${delta} ms dari batas siklus (harapan ≈ 0; negatif besar = pindah terlalu cepat)`);
if (delta < -90) {
  console.log('❌ transisi terjadi LEBIH AWAL dari batas siklus');
} else {
  console.log('✅ transisi jatuh di batas siklus (dalam toleransi deteksi DOM)');
}

await browser.close();
await api(`/songs/${song.id}`, { method: 'DELETE' });
console.log('lagu uji dihapus');
