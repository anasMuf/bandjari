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

/** Tambahkan `count` langkah di akhir berisi key default (kontrol +8 step). */
export function padSteps(steps: string, count: number, defaultKey: string): string {
  if (count <= 0) return steps;
  return steps + defaultKey.repeat(count);
}

/** Kurangi hingga `count` langkah dari akhir (kontrol −8 step), minimal kosong. */
export function trimSteps(steps: string, count: number): string {
  if (count <= 0) return steps;
  return steps.slice(0, Math.max(0, steps.length - count));
}

/**
 * Set sel pada kolom colIndex; bila kolom di luar panjang steps saat ini,
 * isi celah antaranya dengan defaultKey (perilaku klik "melampaui panjang"
 * pada grid terpadu antar Part).
 */
export function setStepExtending(steps: string, colIndex: number, key: string, defaultKey: string): string {
  const cells = decodeSteps(steps);
  while (cells.length < colIndex) cells.push(defaultKey);
  return encodeSteps(setCell(cells, colIndex, key));
}
