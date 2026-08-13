import { describe, expect, it } from 'vitest';
import {
  cycleLength,
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
  it('stepDurationSeconds konversi BPM', () => {
    expect(stepDurationSeconds(120)).toBeCloseTo(0.5);
    expect(stepDurationSeconds(60)).toBeCloseTo(1);
  });

  it('cycleLength = panjang steps terpanjang (AC-2)', () => {
    expect(cycleLength([part('TDTD', ['T', 'D']), part('TDTDTDTDTDTDTDTDTDTDTDTD', ['T', 'D'])])).toBe(24);
    expect(cycleLength([])).toBe(0);
  });

  it('stepKeysAt loop tiap part sesuai panjangnya sendiri', () => {
    const parts = [part('TDTD', ['T', 'D']), part('DD', ['D'])];
    // part2 panjang 2 → pada index 2 kembali ke awal (D), part1 lanjut (T)
    expect(stepKeysAt(parts, 2)).toEqual([
      { key: 'T', buffer: expect.anything() },
      { key: 'D', buffer: expect.anything() },
    ]);
  });

  it('stepKeysAt mengembalikan buffer undefined untuk key tak dikenal (senyap)', () => {
    const parts = [part('TK', ['T'])];
    expect(stepKeysAt(parts, 1)).toEqual([{ key: 'K', buffer: undefined }]);
  });

  it('stepKeysAt menangani steps kosong', () => {
    const parts = [part('', [])];
    expect(stepKeysAt(parts, 0)).toEqual([{ key: '', buffer: undefined }]);
  });
});
