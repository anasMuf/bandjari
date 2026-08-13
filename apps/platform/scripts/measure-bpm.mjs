// Ukur durasi step aktual di browser pada BPM 120 vs 90 — bukti apakah pemutar
// benar-benar mengikuti BPM. Membuat lagu uji sementara lalu menghapusnya.
import { chromium } from 'playwright';

const API = 'http://localhost:8080/api/v1';
const BASE = 'http://localhost:3000';
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

// 1) Siapkan lagu uji: bpm 120, satu section, slot Tak/T, steps 4.
const song = (await api('/songs', { method: 'POST', body: JSON.stringify({ name: '__uji_bpm__', bpm: 120 }) })).data;
const section = (await api(`/songs/${song.id}/sections`, { method: 'POST', body: JSON.stringify({ name: 'A' }) })).data;
const parts = (await api(`/sections/${section.id}/parts`)).data;
const rebana1 = parts.find((p) => p.part === 'rebana1');
await api(`/section-parts/${rebana1.id}/sound-slots`, { method: 'POST', body: JSON.stringify({ label: 'Tak', key: 'T' }) });
await api(`/section-parts/${rebana1.id}`, { method: 'PUT', body: JSON.stringify({ steps: { set: true, value: 'T,T,T,T' } }) });
console.log(`lagu uji id=${song.id}, section=${section.id}, part=${rebana1.id}`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript((t) => localStorage.setItem('token', t), TOKEN);

async function measureLauncher(label) {
  await page.goto(`${BASE}/songs/${song.id}/play`);
  await page.waitForSelector('button[aria-label^="Mainkan section"]', { timeout: 20000 });
  await page.click('button[aria-label^="Mainkan section"]');
  await page.waitForSelector('span.sr-only', { timeout: 5000 });
  const changes = [];
  let last = null;
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const txt = await page.locator('span.sr-only').first().textContent().catch(() => null);
    if (txt && txt !== last) {
      if (last !== null) changes.push(Date.now());
      last = txt;
    }
    await page.waitForTimeout(30);
  }
  await page.click('button:has-text("■ Stop")');
  const gaps = changes.slice(1).map((t, i) => t - changes[i]);
  const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;
  console.log(`${label}: ${gaps.length} transisi, rata-rata ${avg.toFixed(0)} ms/step (harapan ${label.includes('120') ? '500' : '667'})`);
}

async function measureSequencerPreview(label) {
  await page.goto(`${BASE}/songs/${song.id}/sections/${section.id}`);
  await page.waitForSelector('button:has-text("▶ Play Preview")', { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.click('button:has-text("▶ Play Preview")');
  await page.waitForTimeout(400);
  const changes = [];
  let last = null;
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const idx = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('tbody button[aria-label^="Langkah "]'));
      return cells.findIndex((c) => c.className.includes('bg-brand-100'));
    });
    if (idx >= 0 && idx !== last) {
      if (last !== null) changes.push(Date.now());
      last = idx;
    }
    await page.waitForTimeout(30);
  }
  const stop = page.locator('button:has-text("■ Stop Preview")');
  if ((await stop.count()) > 0) await stop.click();
  const gaps = changes.slice(1).map((t, i) => t - changes[i]);
  const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;
  console.log(`${label}: ${gaps.length} transisi, rata-rata ${avg.toFixed(0)} ms/step`);
}

await measureLauncher('launcher @120');
await measureSequencerPreview('sequencer preview @120');

// 2) Ubah BPM dasar jadi 90, ulangi pengukuran.
await api(`/songs/${song.id}`, { method: 'PUT', body: JSON.stringify({ bpm: 90 }) });
await measureLauncher('launcher @90');
await measureSequencerPreview('sequencer preview @90');

// 3) Set BPM override section = 120 (dasar 90) → sequencer preview wajib ~500ms.
await api(`/sections/${section.id}`, {
  method: 'PUT',
  body: JSON.stringify({ bpm_override: { set: true, value: 120 } }),
});
await measureSequencerPreview('sequencer preview @override120 (dasar 90)');

await browser.close();

// 3) Bersihkan lagu uji.
await api(`/songs/${song.id}`, { method: 'DELETE' });
console.log(`lagu uji ${song.id} dihapus`);
