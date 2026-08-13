import { describe, expect, it } from 'vitest';
import {
  appendColumn,
  decodeSteps,
  encodeSteps,
  keyAt,
  padSteps,
  removeColumn,
  setCell,
  setStepExtending,
  stepCount,
  trimSteps,
} from './steps';

describe('steps (format koma)', () => {
  it('decode memecah string menjadi token per koma', () => {
    expect(decodeSteps('T,D,T,D')).toEqual(['T', 'D', 'T', 'D']);
    expect(decodeSteps('T,KD')).toEqual(['T', 'KD']);
    expect(decodeSteps('')).toEqual([]);
  });

  it('encode menggabungkan token dengan koma (round-trip)', () => {
    expect(encodeSteps(decodeSteps('T,D,KD'))).toBe('T,D,KD');
    expect(encodeSteps(['T', 'KD', 'D'])).toBe('T,KD,D');
  });

  it('setCell mengganti isi satu kolom tanpa mengubah kolom lain', () => {
    const cells = decodeSteps('T,D,T,D');
    expect(setCell(cells, 1, 'KD')).toEqual(['T', 'KD', 'T', 'D']);
  });

  it('removeColumn menghapus satu posisi dan menggeser sisanya', () => {
    const cells = decodeSteps('T,D,T,D');
    expect(encodeSteps(removeColumn(cells, 0))).toBe('D,T,D');
    expect(encodeSteps(removeColumn(cells, 2))).toBe('T,D,D');
  });

  it('appendColumn menambah posisi di akhir dengan key default', () => {
    expect(encodeSteps(appendColumn(decodeSteps('T,D'), 'KD'))).toBe('T,D,KD');
    expect(encodeSteps(appendColumn([], 'D'))).toBe('D');
  });

  it('padSteps menambah N langkah berisi key default di akhir', () => {
    expect(padSteps('T,D', 8, 'T')).toBe('T,D,T,T,T,T,T,T,T,T');
    expect(padSteps('', 8, 'KD')).toBe('KD,KD,KD,KD,KD,KD,KD,KD');
    expect(padSteps('T,D', 0, 'T')).toBe('T,D');
  });

  it('trimSteps memotong hingga N langkah dari akhir', () => {
    expect(trimSteps('T,D,T,D,T,D,T,D,T,D', 8)).toBe('T,D');
    expect(trimSteps('T,D', 8)).toBe('');
    expect(trimSteps('T,D', 0)).toBe('T,D');
  });

  it('setStepExtending mengisi celah di luar panjang dengan defaultKey', () => {
    expect(setStepExtending('T,D', 4, 'K', 'T')).toBe('T,D,T,T,K');
    expect(setStepExtending('T,D', 1, 'K', 'T')).toBe('T,K');
  });

  it('stepCount menghitung jumlah langkah (bukan karakter)', () => {
    expect(stepCount('T,D,KD')).toBe(3);
    expect(stepCount('')).toBe(0);
  });

  it('keyAt loop sesuai panjang steps dan mendukung key 2 karakter', () => {
    expect(keyAt('T,D,KD', 0)).toBe('T');
    expect(keyAt('T,D,KD', 2)).toBe('KD');
    expect(keyAt('T,D,KD', 3)).toBe('T'); // loop
    expect(keyAt('', 0)).toBeUndefined();
  });
});
