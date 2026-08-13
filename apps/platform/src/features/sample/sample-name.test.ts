import { describe, expect, it } from 'vitest';
import { sampleNameFromFileName } from './sample-name';

describe('sampleNameFromFileName', () => {
  it('membuang ekstensi .wav', () => {
    expect(sampleNameFromFileName('WEDOK TEK.wav')).toBe('WEDOK TEK');
    expect(sampleNameFromFileName('BASS DUNG.wav')).toBe('BASS DUNG');
  });

  it('membuang ekstensi .WAV kapital', () => {
    expect(sampleNameFromFileName('LANANG DUK.WAV')).toBe('LANANG DUK');
  });

  it('memangkas spasi berlebih setelah ekstensi dibuang', () => {
    expect(sampleNameFromFileName('  GL TEK .wav')).toBe('GL TEK');
  });

  it('tidak mengubah nama tanpa ekstensi', () => {
    expect(sampleNameFromFileName('REBANA')).toBe('REBANA');
  });

  it('fallback ke nama file bila hasil kosong', () => {
    expect(sampleNameFromFileName('.wav')).toBe('.wav');
    expect(sampleNameFromFileName(' .WAV ')).toBe('.WAV');
  });
});
