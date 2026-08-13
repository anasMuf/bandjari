import { describe, expect, it } from 'vitest';
import {
  clearCell,
  decodeSteps,
  encodeSteps,
  keyAt,
  padSteps,
  setCell,
  setStepExtending,
  stepCount,
  trimSteps,
} from './steps';

describe('steps (format koma + langkah istirahat)', () => {
  it('decode memecah string menjadi token per koma; "." menjadi sel kosong', () => {
    expect(decodeSteps('T,D,T,D')).toEqual(['T', 'D', 'T', 'D']);
    expect(decodeSteps('T,KD')).toEqual(['T', 'KD']);
    expect(decodeSteps('T,.,D')).toEqual(['T', null, 'D']);
    expect(decodeSteps('')).toEqual([]);
  });

  it('encode menggabungkan token; sel kosong menjadi "." (round-trip)', () => {
    expect(encodeSteps(decodeSteps('T,D,KD'))).toBe('T,D,KD');
    expect(encodeSteps(['T', null, 'D'])).toBe('T,.,D');
    expect(encodeSteps(decodeSteps('T,.,KD'))).toBe('T,.,KD');
  });

  it('setCell mengganti isi satu kolom tanpa mengubah kolom lain', () => {
    const cells = decodeSteps('T,D,T,D');
    expect(setCell(cells, 1, 'KD')).toEqual(['T', 'KD', 'T', 'D']);
  });

  it('clearCell mematikan satu kotak menjadi istirahat tanpa menggeser kotak lain', () => {
    const cells = decodeSteps('T,T,T,T');
    expect(encodeSteps(clearCell(cells, 2))).toBe('T,T,.,T');
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
    expect(stepCount('')).toBe(0);
  });

  it('keyAt loop sesuai panjang steps; istirahat → undefined', () => {
    expect(keyAt('T,D,KD', 0)).toBe('T');
    expect(keyAt('T,D,KD', 2)).toBe('KD');
    expect(keyAt('T,D,KD', 3)).toBe('T'); // loop
    expect(keyAt('T,.,D', 1)).toBeUndefined(); // istirahat
    expect(keyAt('', 0)).toBeUndefined();
  });
});
