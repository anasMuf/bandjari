import type { ScheduledPart } from './scheduling-math';

export interface SectionDefinition {
  parts: ScheduledPart[];
  bpm: number;
}

/** Antarmuka minimal scheduler — memudahkan pengujian SectionPlayer. */
export interface SchedulerLike {
  isPlaying: boolean;
  /** startAt opsional: timestamp mulai presisi (dipakai transisi di batas siklus). */
  start(parts: ScheduledPart[], bpm: number, startAt?: number): void;
  stop(): void;
  /** Dipanggil tepat di akhir siklus — boundaryTime = timestamp batas siklus. */
  onCycleComplete: ((boundaryTime: number) => void) | null;
}

/**
 * State machine playback per Section dengan quantized trigger (FR-PLAY-04):
 * pindah Section tidak langsung terjadi — menunggu akhir siklus Section aktif,
 * lalu Section baru mulai dengan BPM efektifnya seketika (hard cut, FR-PLAY-11).
 */
export class SectionPlayer {
  private sections = new Map<number, SectionDefinition>();
  private scheduler: SchedulerLike;

  activeSectionId: number | null = null;
  pendingSectionId: number | null = null;

  constructor(scheduler: SchedulerLike) {
    this.scheduler = scheduler;
    scheduler.onCycleComplete = (boundaryTime) => this.handleCycleComplete(boundaryTime);
  }

  /** Trigger pad Section — mulai bila idle, antre bila section lain aktif. */
  trigger(sectionId: number, definition: SectionDefinition): void {
    this.sections.set(sectionId, definition);
    if (!this.scheduler.isPlaying) {
      this.activeSectionId = sectionId;
      this.pendingSectionId = null;
      this.scheduler.start(definition.parts, definition.bpm);
    } else if (sectionId !== this.activeSectionId) {
      this.pendingSectionId = sectionId; // quantized trigger — tunggu akhir siklus
    } else {
      this.scheduler.start(definition.parts, definition.bpm); // re-trigger aktif → mulai ulang
    }
  }

  stop(): void {
    this.scheduler.stop();
    this.activeSectionId = null;
    this.pendingSectionId = null;
  }

  private handleCycleComplete(boundaryTime: number): void {
    if (this.pendingSectionId == null) return;
    const nextId = this.pendingSectionId;
    const next = this.sections.get(nextId);
    this.pendingSectionId = null;
    if (!next) return;
    this.activeSectionId = nextId;
    // Section baru dimulai TEPAT di timestamp batas siklus section lama —
    // bukan lebih awal (quantized trigger presisi, FR-PLAY-04). BPM baru
    // diterapkan seketika pada langkah pertamanya (hard cut, FR-PLAY-11).
    this.scheduler.start(next.parts, next.bpm, boundaryTime);
  }
}
