import { describe, expect, it } from 'vitest';
import { scaleBpm } from './bpm';

describe('scaleBpm (kontrol BPM temporary launcher)', () => {
  it('tanpa temp BPM → override ?? base apa adanya', () => {
    expect(scaleBpm(null, 100, null)).toBe(100);
    expect(scaleBpm(120, 100, null)).toBe(120);
  });

  it('temp BPM menskalakan section TANPA override sesuai rasio', () => {
    expect(scaleBpm(null, 100, 90)).toBe(90);
    expect(scaleBpm(null, 100, 120)).toBe(120);
  });

  it('temp BPM menskalakan section DENGAN override secara proporsional', () => {
    // dasar 100 → temp 90 (×0,9): override 120 → 108
    expect(scaleBpm(120, 100, 90)).toBe(108);
    // dasar 100 → temp 120 (×1,2): override 80 → 96
    expect(scaleBpm(80, 100, 120)).toBe(96);
  });

  it('nilai presisi float dipertahankan (pembulatan milik lapisan tampilan)', () => {
    // dasar 90 → temp 100 (×1.111...): override 100 → 111.111...
    const result = scaleBpm(100, 90, 100);
    expect(result).toBeCloseTo(111.111, 2);
  });

  it('base BPM 0 (data tidak valid) → aman, kembali ke nilai asli', () => {
    expect(scaleBpm(null, 0, 90)).toBe(0);
    expect(scaleBpm(120, 0, 90)).toBe(120);
  });
});
