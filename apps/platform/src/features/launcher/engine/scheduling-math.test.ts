import { describe, expect, it } from 'vitest';
import {
  cycleLength,
  excludeMutedParts,
  stepDurationSeconds,
  stepKeysAt,
  type ScheduledPart,
} from './scheduling-math';

function part(steps: string, keys: string[]): ScheduledPart {
  const buffers = new Map<string, AudioBuffer>();
  for (const k of keys) buffers.set(k, {} as AudioBuffer);
  return { steps, buffers };
}

describe('scheduling-math', () => {
  it('stepDurationSeconds konversi BPM (1 step = 1/16 ketukan)', () => {
    expect(stepDurationSeconds(120)).toBeCloseTo(0.125); // 120 BPM → 125 ms/step
    expect(stepDurationSeconds(60)).toBeCloseTo(0.25); // 60 BPM → 250 ms/step
    expect(stepDurationSeconds(90)).toBeCloseTo(1 / 6); // 90 BPM → 166,7 ms/step
  });

  it('cycleLength = panjang steps terpanjang (AC-2)', () => {
    const long = Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? 'T' : 'D')).join(','); // 24 langkah
    expect(cycleLength([part('T,D,T,D', ['T', 'D']), part(long, ['T', 'D'])])).toBe(24);
    expect(cycleLength([])).toBe(0);
  });

  it('stepKeysAt loop tiap part sesuai panjangnya sendiri', () => {
    const parts = [part('T,D,T,D', ['T', 'D']), part('D,D', ['D'])];
    // part2 panjang 2 → pada index 2 kembali ke awal (D), part1 lanjut (T)
    expect(stepKeysAt(parts, 2)).toEqual([
      { key: 'T', buffer: expect.anything() },
      { key: 'D', buffer: expect.anything() },
    ]);
  });

  it('stepKeysAt mengembalikan buffer undefined untuk key tak dikenal (senyap)', () => {
    const parts = [part('T,K', ['T'])];
    expect(stepKeysAt(parts, 1)).toEqual([{ key: 'K', buffer: undefined }]);
  });

  it('stepKeysAt mendukung key 2 karakter', () => {
    const parts = [part('T,KD', ['T', 'KD'])];
    expect(stepKeysAt(parts, 1)).toEqual([{ key: 'KD', buffer: expect.anything() }]);
  });

  it('stepKeysAt memperlakukan langkah istirahat sebagai senyap', () => {
    const parts = [part('.,T', ['T'])];
    expect(stepKeysAt(parts, 0)).toEqual([{ key: '', buffer: undefined }]);
    expect(stepKeysAt(parts, 1)).toEqual([{ key: 'T', buffer: expect.anything() }]);
  });

  it('stepKeysAt menangani steps kosong', () => {
    const parts = [part('', [])];
    expect(stepKeysAt(parts, 0)).toEqual([{ key: '', buffer: undefined }]);
  });

  it('excludeMutedParts membuang Part yang di-mute (FR-PLAY-10)', () => {
    const parts = [
      { ...part('TD', ['T', 'D']), part: 'rebana1' },
      { ...part('DD', ['D']), part: 'bass' },
      part('TT', ['T']), // tanpa identitas part → tidak bisa di-mute
    ];
    expect(excludeMutedParts(parts, new Set(['bass']))).toHaveLength(2);
    expect(excludeMutedParts(parts, new Set(['rebana1', 'bass']))).toHaveLength(1);
    expect(excludeMutedParts(parts, new Set())).toHaveLength(3);
  });
});
