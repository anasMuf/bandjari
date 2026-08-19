// Ukur durasi step AKTUAL di launcher saat BPM temporary diubah realtime:
// bukti apakah kontrol BPM benar-benar mengubah tempo audio (bukan hanya label).
// Skenario reproduksi bug: section "sekali" auto-advance ke section loop —
// setelah auto-advance, perubahan BPM realtime dulunya tidak terdengar.
//
// Jalankan dengan API (8080) & vite dev (3000):
//   node scripts/measure-temp-bpm.mjs
import { chromium } from 'playwright';

const API = process.env.BANDJARI_API || 'http://localhost:8080/api/v1';
const BASE = process.env.BANDJARI_BASE || 'http://localhost:3000';

const api = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
};

// 1) Akun uji segar → token.
const email = `bpm-${Date.now()}@test.dev`;
const password = 'secret123';
await api('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'BPM Test', email, password }) });
const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
const token = login?.data?.token ?? login?.token;
if (!token) throw new Error(`login gagal: ${JSON.stringify(login)}`);

// 2) Lagu uji: bpm 90, section A (sekali, order → B), section B (loop).
const song = (await api('/songs', { method: 'POST', token, body: JSON.stringify({ name: '__uji_bpm_temp__', bpm: 90 }) })).data;
const secA = (await api(`/songs/${song.id}/sections`, { method: 'POST', token, body: JSON.stringify({ name: 'A' }) })).data;
const secB = (await api(`/songs/${song.id}/sections`, { method: 'POST', token, body: JSON.stringify({ name: 'B' }) })).data;
await api(`/sections/${secA.id}`, { method: 'PUT', token, body: JSON.stringify({ loop: false }) });

const setupParts = async (section) => {
  const parts = (await api(`/sections/${section.id}/parts`, { token })).data;
  const rebana1 = parts.find((p) => p.part === 'rebana1');
  await api(`/section-parts/${rebana1.id}/sound-slots`, { method: 'POST', token, body: JSON.stringify({ label: 'Tak', key: 'T' }) });
  await api(`/section-parts/${rebana1.id}`, { method: 'PUT', token, body: JSON.stringify({ steps: { set: true, value: 'T,T,T,T' } }) });
};
await setupParts(secA);
await setupParts(secB);
console.log(`lagu uji id=${song.id}, A=${secA.id} (sekali), B=${secB.id} (loop)`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript((t) => localStorage.setItem('token', t), token);

/** Ukur durasi rata-rata antar langkah lewat teks "Langkah X dari Y" (progress bar). */
async function measureSteps(label, ms) {
  const changes = [];
  let last = null;
  const start = Date.now();
  while (Date.now() - start < ms) {
    const txt = await page
      .locator('span[role="progressbar"] span.sr-only')
      .first()
      .textContent()
      .catch(() => null);
    if (txt && txt !== last) {
      if (last !== null) changes.push(Date.now());
      last = txt;
    }
    await page.waitForTimeout(25);
  }
  const gaps = changes.slice(1).map((t, i) => t - changes[i]);
  const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;
  console.log(`${label}: ${gaps.length} langkah, rata-rata ${avg.toFixed(1)} ms/step`);
  return avg;
}

await page.goto(`${BASE}/songs/${song.id}/play`);
await page.waitForSelector('button[aria-label^="Mainkan section"]', { timeout: 20000 });

// Mulai dari pad A → auto-advance ke B (loop). Setelah ini activeSectionRef basi.
await page.click('button[aria-label="Mainkan section A"]');
await page.waitForSelector('span[role="progressbar"]', { timeout: 10000 });
await page.waitForFunction(
  () => document.querySelector('button[aria-label="Mainkan section B"] span:nth-of-type(2)')?.textContent?.includes('sedang main'),
  { timeout: 15000 },
);

const before = await measureSteps('sebelum +5 (90 BPM)', 4000);
await page.click('button[aria-label="Tambah 5 BPM"]');
await page.waitForTimeout(300); // beri waktu scheduler menerapkan tempo baru
const after = await measureSteps('sesudah +5 (95 BPM)', 4000);

const ratio = after / before;
const expected = 90 / 95; // ≈ 0.947
console.log(`rasio terukur: ${ratio.toFixed(3)} (harapan ≈ ${expected.toFixed(3)} bila tempo berubah)`);
const ok = Math.abs(ratio - expected) < 0.02;
console.log(ok ? '✅ TEMPO AUDIO BERUBAH sesuai rasio' : '❌ TEMPO AUDIO TIDAK BERUBAH (bug realtime)');

await browser.close();

// 3) Bersihkan lagu uji.
await api(`/songs/${song.id}`, { method: 'DELETE', token });
console.log(`lagu uji ${song.id} dihapus`);
