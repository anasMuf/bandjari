import { describe, expect, it } from 'vitest';
import {
  appendColumn,
  decodeSteps,
  encodeSteps,
  padSteps,
  removeColumn,
  setCell,
  setStepExtending,
  trimSteps,
} from './steps-codec';

describe('steps-codec', () => {
  it('decode memecah string menjadi sel per karakter', () => {
    expect(decodeSteps('TDTD')).toEqual(['T', 'D', 'T', 'D']);
    expect(decodeSteps('')).toEqual([]);
  });

  it('encode menggabungkan sel non-null (round-trip)', () => {
    expect(encodeSteps(decodeSteps('TDTD'))).toBe('TDTD');
    expect(encodeSteps(['T', null, 'D'])).toBe('TD');
  });

  it('setCell mengganti isi satu kolom tanpa mengubah kolom lain', () => {
    const cells = decodeSteps('TDTD');
    expect(setCell(cells, 1, 'K')).toEqual(['T', 'K', 'T', 'D']);
  });

  it('removeColumn menghapus satu posisi dan menggeser sisanya', () => {
    const cells = decodeSteps('TDTD');
    expect(encodeSteps(removeColumn(cells, 0))).toBe('DTD');
    expect(encodeSteps(removeColumn(cells, 2))).toBe('TDD');
  });

  it('appendColumn menambah posisi di akhir dengan key default', () => {
    expect(encodeSteps(appendColumn(decodeSteps('TD'), 'T'))).toBe('TDT');
    expect(encodeSteps(appendColumn([], 'D'))).toBe('D');
  });

  it('padSteps menambah N langkah berisi key default di akhir', () => {
    expect(padSteps('TD', 8, 'T')).toBe('TDTTTTTTTT');
    expect(padSteps('', 8, 'D')).toBe('DDDDDDDD');
    expect(padSteps('TD', 0, 'T')).toBe('TD');
  });

  it('trimSteps memotong hingga N langkah dari akhir', () => {
    expect(trimSteps('TDTDTDTDTD', 8)).toBe('TD');
    expect(trimSteps('TD', 8)).toBe('');
    expect(trimSteps('TD', 0)).toBe('TD');
  });

  it('setStepExtending mengisi celah di luar panjang dengan defaultKey', () => {
    expect(setStepExtending('TD', 4, 'K', 'T')).toBe('TDTTK');
    expect(setStepExtending('TD', 1, 'K', 'T')).toBe('TK');
  });
});
