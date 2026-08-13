// Serialisasi grid sequencer ↔ string `steps` (format koma — FR-SEQ-02).
// Model: satu kolom grid = satu posisi langkah; satu baris = satu SoundSlot (key).
// Satu kolom boleh memuat BEBERAPA bunyi sekaligus (beberapa baris aktif di kolom
// yang sama) dengan pemisah "+": "T+D,.,KD". Langkah istirahat = token ".".
// Key boleh 1–2 karakter. Dipakai bersama oleh Sequencer dan Launcher engine.

/** Isi satu sel: daftar key yang aktif, atau null (langkah istirahat). */
export type StepCell = string[] | null;

export const REST_STEP = '.';

/** Lebar minimal grid sequencer (kolom yang selalu tampil). */
export const MIN_GRID_COLUMNS = 8;

/** Pecah string steps menjadi sel-sel grid ("." → sel kosong, "T+D" → [T, D]). */
export function decodeSteps(steps: string): StepCell[] {
  if (!steps) return [];
  return steps.split(',').map((token) => (token === REST_STEP ? null : token.split('+')));
}

/** Gabungkan sel-sel grid menjadi string steps (sel kosong → "."). */
export function encodeSteps(cells: StepCell[]): string {
  return cells.map((cell) => (cell === null ? REST_STEP : cell.join('+'))).join(',');
}

/** Ganti isi satu kolom menjadi satu key (kolom lain tak berubah). */
export function setCell(cells: StepCell[], colIndex: number, key: string): StepCell[] {
  const next = [...cells];
  next[colIndex] = [key];
  return next;
}

/** Matikan satu kotak: ganti isi kolom menjadi istirahat (null). */
export function clearCell(cells: StepCell[], colIndex: number): StepCell[] {
  const next = [...cells];
  next[colIndex] = null;
  return next;
}

/**
 * Toggle satu kotak (baris × kolom) secara independen: bila key baris ini aktif
 * di kolom tsb → hilangkan (kolom jadi istirahat bila kosong); bila tidak →
 * tambahkan ke kolom itu TANPA mengganggu key baris lain yang aktif di kolom
 * yang sama.
 */
export function toggleKeyInCell(cells: StepCell[], colIndex: number, key: string): StepCell[] {
  const next = [...cells];
  const cell = next[colIndex];
  if (cell === null) {
    next[colIndex] = [key];
    return next;
  }
  if (cell.includes(key)) {
    const rest = cell.filter((k) => k !== key);
    next[colIndex] = rest.length > 0 ? rest : null;
  } else {
    next[colIndex] = [...cell, key];
  }
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
 * Set satu kotak pada kolom colIndex; bila kolom di luar panjang steps saat
 * ini, isi celah antaranya dengan langkah istirahat — klik satu kotak hanya
 * mengisi kotak itu.
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

/**
 * Normalisasi panjang pola ke lebar grid minimal: pola berisi (1..7 langkah)
 * digenapi menjadi MIN_GRID_COLUMNS dengan langkah istirahat — sehingga siklus
 * playback mengikuti lebar grid yang tampil, bukan jumlah kotak terisi.
 * Pola kosong dibiarkan kosong; pola ≥ MIN_GRID_COLUMNS tidak berubah.
 */
export function normalizeStepsToGrid(steps: string): string {
  const count = stepCount(steps);
  if (count === 0 || count >= MIN_GRID_COLUMNS) return steps;
  return padSteps(steps, MIN_GRID_COLUMNS - count);
}

/** Daftar key aktif pada indeks langkah global — loop sesuai panjang (AC-2). Istirahat → undefined. */
export function keyAt(steps: string, index: number): string[] | undefined {
  const cells = decodeSteps(steps);
  if (cells.length === 0) return undefined;
  const cell = cells[index % cells.length];
  return cell ?? undefined;
}
