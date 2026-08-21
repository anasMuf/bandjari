import { describe, expect, it } from 'vitest';
import { parseFaq } from './FaqAccordion';

describe('parseFaq', () => {
  it('mengubah tiap heading `##` menjadi satu item akordeon', () => {
    const markdown = [
      '## Apa itu BandJari?',
      'BandJari adalah aplikasi web.',
      '',
      '## Apakah gratis?',
      'Ya, gratis.',
    ].join('\n');

    const items = parseFaq(markdown);

    expect(items).toHaveLength(2);
    expect(items[0].question).toBe('Apa itu BandJari?');
    expect(items[0].answer).toContain('BandJari adalah aplikasi web.');
    expect(items[1].question).toBe('Apakah gratis?');
    expect(items[1].answer).toContain('Ya, gratis.');
  });

  it('menggabungkan jawaban multi-baris hingga heading berikutnya', () => {
    const markdown = [
      '## Pertanyaan',
      'Baris satu.',
      'Baris dua.',
      '',
      '## Pertanyaan kedua',
      'Jawaban kedua.',
    ].join('\n');

    const items = parseFaq(markdown);

    expect(items[0].answer).toContain('Baris satu.');
    expect(items[0].answer).toContain('Baris dua.');
    expect(items[0].answer).not.toContain('Jawaban kedua.');
  });

  it('mengabaikan heading yang tidak punya jawaban', () => {
    const items = parseFaq('## Pertanyaan tanpa jawaban');
    expect(items).toHaveLength(0);
  });

  it('mengabaikan teks pengantar sebelum heading pertama', () => {
    const items = parseFaq('Pembuka dokumen.\n## Q1\nA1.');
    expect(items).toHaveLength(1);
    expect(items[0].question).toBe('Q1');
  });

  it('mengembalikan daftar kosong untuk input kosong', () => {
    expect(parseFaq('')).toEqual([]);
  });
});
