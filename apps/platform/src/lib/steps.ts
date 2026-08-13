// Serialisasi grid sequencer ↔ string `steps` (format koma — FR-SEQ-02).
// Model: satu kolom grid = satu posisi langkah; satu baris = satu SoundSlot (key).
// Key boleh 1–2 karakter, sehingga tiap langkah disimpan sebagai token UTUH yang
// dipisah koma: "T,D,KD". Langkah istirahat (senyap, tanpa pukulan) = token "." —
// dipakai saat user mengisi kotak yang posisinya melompati kotak kosong di kirinya.
// Dipakai bersama oleh Sequencer dan Launcher engine.

/** Sel kosong (langkah istirahat) dalam bentuk null. */
export type StepCell = string | null;

export const REST_STEP = '.';

/** Pecah string steps menjadi sel-sel grid (token "." menjadi sel kosong). */
export function decodeSteps(steps: string): StepCell[] {
  if (!steps) return [];
  return steps.split(',').map((token) => (token === REST_STEP ? null : token));
}

/** Gabungkan sel-sel grid menjadi string steps (sel kosong menjadi "."). */
export function encodeSteps(cells: StepCell[]): string {
  return cells.map((cell) => cell ?? REST_STEP).join(',');
}

/** Set sel pada kolom ke key tertentu (menggantikan isi kolom). */
export function setCell(cells: StepCell[], colIndex: number, key: string): StepCell[] {
  const next = [...cells];
  next[colIndex] = key;
  return next;
}

/** Matikan satu langkah: ganti isi kolom menjadi istirahat (null). */
export function clearCell(cells: StepCell[], colIndex: number): StepCell[] {
  const next = [...cells];
  next[colIndex] = null;
  return next;
}

/** Tambahkan `count` langkah istirahat di akhir (kontrol +8 step). */
export function padSteps(steps: string, count: number): string {
  if (count <= 0) return steps;
  return encodeSteps([...decodeSteps(steps), ...Array.from({ length: count }, () => null)]);
}

/** Kurangi hingga `count` langkah dari akhir (kontrol −8 step), minimal kosong. */
export function trimSteps(steps: string, count: number): string {
  if (count <= 0) return steps;
  const cells = decodeSteps(steps);
  return encodeSteps(cells.slice(0, Math.max(0, cells.length - count)));
}

/**
 * Set sel pada kolom colIndex; bila kolom di luar panjang steps saat ini,
 * isi celah antaranya dengan langkah istirahat (senyap) — klik satu kotak
 * hanya mengisi kotak itu, kotak di kirinya tidak ikut terisi.
 */
export function setStepExtending(steps: string, colIndex: number, key: string): string {
  const cells = decodeSteps(steps);
  while (cells.length < colIndex) cells.push(null);
  return encodeSteps(setCell(cells, colIndex, key));
}

/** Jumlah langkah (termasuk istirahat) — token dipisah koma. */
export function stepCount(steps: string): number {
  return decodeSteps(steps).length;
}

/** Key pada indeks langkah global — loop sesuai panjang steps (AC-2). Istirahat → undefined. */
export function keyAt(steps: string, index: number): string | undefined {
  const cells = decodeSteps(steps);
  if (cells.length === 0) return undefined;
  const cell = cells[index % cells.length];
  return cell ?? undefined;
}
