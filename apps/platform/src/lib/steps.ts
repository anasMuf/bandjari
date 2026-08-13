// Serialisasi grid sequencer ↔ string `steps` (format koma — FR-SEQ-02).
// Model: satu kolom grid = satu posisi langkah; satu baris = satu SoundSlot (key).
// Key boleh 1–2 karakter, sehingga tiap langkah disimpan sebagai token UTUH yang
// dipisah koma: "T,D,KD". Tidak ada langkah istirahat — posisi senyap dicapai
// lewat SoundSlot tanpa sample (AC-5). Dipakai bersama oleh Sequencer dan
// Launcher engine.

export type StepCell = string;

/** Pecah string steps menjadi sel-sel grid (satu token per sel). */
export function decodeSteps(steps: string): StepCell[] {
  if (!steps) return [];
  return steps.split(',');
}

/** Gabungkan sel-sel grid menjadi string steps (token dipisah koma). */
export function encodeSteps(cells: StepCell[]): string {
  return cells.join(',');
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
  return encodeSteps([...decodeSteps(steps), ...Array.from({ length: count }, () => defaultKey)]);
}

/** Kurangi hingga `count` langkah dari akhir (kontrol −8 step), minimal kosong. */
export function trimSteps(steps: string, count: number): string {
  if (count <= 0) return steps;
  const cells = decodeSteps(steps);
  return encodeSteps(cells.slice(0, Math.max(0, cells.length - count)));
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

/** Jumlah langkah (bukan jumlah karakter) — token dipisah koma. */
export function stepCount(steps: string): number {
  return decodeSteps(steps).length;
}

/** Key pada indeks langkah global — loop sesuai panjang steps (AC-2). */
export function keyAt(steps: string, index: number): string | undefined {
  const cells = decodeSteps(steps);
  if (cells.length === 0) return undefined;
  return cells[index % cells.length];
}
