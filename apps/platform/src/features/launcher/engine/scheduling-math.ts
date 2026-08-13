// Fungsi murni scheduling — dipisah agar dapat di-test tanpa AudioContext.

export interface ScheduledPart {
  /** Rumus pukulan (string key). */
  steps: string;
  /** Buffer audio per key SoundSlot. Key tanpa buffer = senyap (AC-5). */
  buffers: Map<string, AudioBuffer>;
}

/** Durasi satu step dalam detik pada BPM tertentu. */
export function stepDurationSeconds(bpm: number): number {
  return 60 / bpm;
}

/**
 * Panjang siklus Section = panjang steps terpanjang di antara part-partnya.
 * Titik akhir siklus ini dipakai quantized trigger untuk berpindah Section.
 */
export function cycleLength(parts: ScheduledPart[]): number {
  return parts.reduce((max, p) => Math.max(max, p.steps.length), 0);
}

/** Key tiap part pada indeks langkah global (tiap part loop sesuai panjangnya — AC-2). */
export function stepKeysAt(parts: ScheduledPart[], index: number): Array<{ key: string; buffer: AudioBuffer | undefined }> {
  return parts.map((part) => {
    if (part.steps.length === 0) return { key: '', buffer: undefined };
    const key = part.steps[index % part.steps.length];
    return { key, buffer: part.buffers.get(key) };
  });
}
