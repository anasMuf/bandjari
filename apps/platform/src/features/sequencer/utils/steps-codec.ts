// Serialisasi grid sequencer ↔ string `steps`.
// Model: satu kolom grid = satu posisi step; satu baris = satu SoundSlot (key).
// Tidak ada karakter "istirahat" dalam steps — posisi senyap dicapai lewat
// SoundSlot tanpa sample (AC-5), sehingga setiap karakter selalu sebuah key.

export type StepCell = string | null;

/** Pecah string steps menjadi sel-sel grid (satu sel per karakter). */
export function decodeSteps(steps: string): StepCell[] {
  return steps.split('');
}

/** Gabungkan sel-sel grid menjadi string steps (sel null dibuang). */
export function encodeSteps(cells: StepCell[]): string {
  return cells.filter((c): c is string => c !== null).join('');
}

/** Set sel pada kolom ke key tertentu (menggantikan isi kolom). */
export function setCell(cells: StepCell[], colIndex: number, key: string): StepCell[] {
  const next = [...cells];
  next[colIndex] = key;
  return next;
}

/** Hapus satu kolom (step) — steps memendek satu posisi. */
export function removeColumn(cells: StepCell[], colIndex: number): StepCell[] {
  return cells.filter((_, i) => i !== colIndex);
}

/** Tambah kolom di akhir berisi defaultKey. */
export function appendColumn(cells: StepCell[], defaultKey: string): StepCell[] {
  return [...cells, defaultKey];
}
