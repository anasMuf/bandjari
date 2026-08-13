import { describe, expect, it } from 'vitest';
import {
  clearCell,
  decodeSteps,
  encodeSteps,
  keyAt,
  normalizeStepsToGrid,
  padSteps,
  roundUpToStepMultiple,
  setCell,
  setStepExtending,
  stepCount,
  toggleKeyInCell,
  trimSteps,
} from './steps';

describe('steps (format koma + multi-bunyi sekolom + istirahat)', () => {
  it('decode memecah token; "." → kosong; "T+D" → dua key', () => {
    expect(decodeSteps('T,D,T,D')).toEqual([['T'], ['D'], ['T'], ['D']]);
    expect(decodeSteps('T,KD')).toEqual([['T'], ['KD']]);
    expect(decodeSteps('T,.,D')).toEqual([['T'], null, ['D']]);
    expect(decodeSteps('T+D,.,KD')).toEqual([['T', 'D'], null, ['KD']]);
    expect(decodeSteps('')).toEqual([]);
  });

  it('encode menggabungkan token; sel kosong → "." (round-trip)', () => {
    expect(encodeSteps(decodeSteps('T,D,KD'))).toBe('T,D,KD');
    expect(encodeSteps([['T'], null, ['D']])).toBe('T,.,D');
    expect(encodeSteps(decodeSteps('T+D,.,KD'))).toBe('T+D,.,KD');
  });

  it('setCell mengganti isi satu kolom tanpa mengubah kolom lain', () => {
    const cells = decodeSteps('T,D,T,D');
    expect(setCell(cells, 1, 'KD')).toEqual([['T'], ['KD'], ['T'], ['D']]);
  });

  it('clearCell mematikan satu kotak menjadi istirahat tanpa menggeser kotak lain', () => {
    const cells = decodeSteps('T,T,T,T');
    expect(encodeSteps(clearCell(cells, 2))).toBe('T,T,.,T');
  });

  it('toggleKeyInCell: dua baris bisa aktif di kolom yang sama', () => {
    const cells = decodeSteps('T,.,T');
    expect(encodeSteps(toggleKeyInCell(cells, 1, 'D'))).toBe('T,D,T');
    // toggle key yang sudah aktif di kolom berisi banyak key → hanya key itu hilang
    const multi = decodeSteps('T+D,D');
    expect(encodeSteps(toggleKeyInCell(multi, 0, 'T'))).toBe('D,D');
    // toggle off key terakhir → kolom jadi istirahat
    expect(encodeSteps(toggleKeyInCell(decodeSteps('T,D'), 0, 'T'))).toBe('.,D');
    // toggle on lagi dari istirahat
    expect(encodeSteps(toggleKeyInCell(decodeSteps('.,D'), 0, 'T'))).toBe('T,D');
  });

  it('padSteps menambah N langkah istirahat di akhir', () => {
    expect(padSteps('T,D', 8)).toBe('T,D,.,.,.,.,.,.,.,.');
    expect(padSteps('', 3)).toBe('.,.,.');
    expect(padSteps('T,D', 0)).toBe('T,D');
  });

  it('trimSteps memotong hingga N langkah dari akhir', () => {
    expect(trimSteps('T,D,.,.,.,.,.,.,.,.', 8)).toBe('T,D');
    expect(trimSteps('T,D', 8)).toBe('');
    expect(trimSteps('T,D', 0)).toBe('T,D');
  });

  it('setStepExtending hanya mengisi kotak yang diklik — celah jadi istirahat', () => {
    expect(setStepExtending('T,D', 4, 'K')).toBe('T,D,.,.,K');
    expect(setStepExtending('', 3, 'T')).toBe('.,.,.,T');
    expect(setStepExtending('T,D', 1, 'K')).toBe('T,K');
  });

  it('stepCount menghitung jumlah langkah termasuk istirahat', () => {
    expect(stepCount('T,D,KD')).toBe(3);
    expect(stepCount('T,.,.')).toBe(3);
    expect(stepCount('T+D,KD')).toBe(2);
    expect(stepCount('')).toBe(0);
  });

  it('normalizeStepsToGrid menggenapi pola pendek ke lebar grid minimal (8) dengan istirahat', () => {
    expect(normalizeStepsToGrid('T')).toBe('T,.,.,.,.,.,.,.');
    expect(normalizeStepsToGrid('T,.,D')).toBe('T,.,D,.,.,.,.,.');
    expect(normalizeStepsToGrid('T,D,T,D,T,D,T,D')).toBe('T,D,T,D,T,D,T,D'); // sudah 8 — tak berubah
    expect(normalizeStepsToGrid('')).toBe(''); // kosong dibiarkan kosong
    expect(normalizeStepsToGrid('T,D,T,D,T,D,T,D,T')).toBe('T,D,T,D,T,D,T,D,T,.,.,.'); // 9 → 12 (kelipatan 4)
  });

  it('normalizeStepsToGrid membulatkan ke kelipatan beat (4) agar kolom tidak terpotong', () => {
    const nine = Array.from({ length: 9 }, () => 'T').join(',');
    expect(normalizeStepsToGrid(nine)).toBe(`${nine},.,.,.`); // 9 → 12
    const thirteen = Array.from({ length: 13 }, () => 'T').join(',');
    expect(normalizeStepsToGrid(thirteen)).toBe(`${thirteen},.,.,.`); // 13 → 16
    const sixteen = Array.from({ length: 16 }, () => 'T').join(',');
    expect(normalizeStepsToGrid(sixteen)).toBe(sixteen); // 16 — tak berubah
  });

  it('roundUpToStepMultiple membulatkan ke kelipatan 4 minimal 8', () => {
    expect(roundUpToStepMultiple(1)).toBe(8);
    expect(roundUpToStepMultiple(7)).toBe(8);
    expect(roundUpToStepMultiple(8)).toBe(8);
    expect(roundUpToStepMultiple(9)).toBe(12);
    expect(roundUpToStepMultiple(13)).toBe(16);
    expect(roundUpToStepMultiple(16)).toBe(16);
  });

  it('keyAt loop sesuai panjang steps; istirahat → undefined; multi-bunyi → array', () => {
    expect(keyAt('T,D,KD', 0)).toEqual(['T']);
    expect(keyAt('T+D,KD', 0)).toEqual(['T', 'D']);
    expect(keyAt('T,D,KD', 3)).toEqual(['T']); // loop
    expect(keyAt('T,.,D', 1)).toBeUndefined(); // istirahat
    expect(keyAt('', 0)).toBeUndefined();
  });
});
