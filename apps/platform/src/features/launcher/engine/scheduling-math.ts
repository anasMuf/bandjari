// Fungsi murni scheduling — dipisah agar dapat di-test tanpa AudioContext.
// Format steps: key dipisah koma (mis. "T,D,KD") — lihat src/lib/steps.ts.

import { keyAt, stepCount } from '../../../lib/steps';

export interface ScheduledPart {
  /** Identitas Part (rebana1..bass) — dipakai filter Mute per Part (FR-PLAY-10). */
  part?: string;
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
  return parts.reduce((max, p) => Math.max(max, stepCount(p.steps)), 0);
}

/** Key tiap part pada indeks langkah global (tiap part loop sesuai panjangnya — AC-2). */
export function stepKeysAt(parts: ScheduledPart[], index: number): Array<{ key: string; buffer: AudioBuffer | undefined }> {
  return parts.map((part) => {
    const key = keyAt(part.steps, index);
    if (key === undefined) return { key: '', buffer: undefined };
    return { key, buffer: part.buffers.get(key) };
  });
}

/** Buang Part yang sedang di-mute (FR-PLAY-10) — tidak mengubah Part lainnya. */
export function excludeMutedParts(parts: ScheduledPart[], muted: Set<string>): ScheduledPart[] {
  return parts.filter((p) => !p.part || !muted.has(p.part));
}
