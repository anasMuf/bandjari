import type { ScheduledPart } from './scheduling-math';

export interface SectionDefinition {
  parts: ScheduledPart[];
  bpm: number;
}

/** Antarmuka minimal scheduler — memudahkan pengujian SectionPlayer. */
export interface SchedulerLike {
  isPlaying: boolean;
  start(parts: ScheduledPart[], bpm: number): void;
  stop(): void;
  onCycleComplete: (() => void) | null;
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
    scheduler.onCycleComplete = () => this.handleCycleComplete();
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

  private handleCycleComplete(): void {
    if (this.pendingSectionId == null) return;
    const nextId = this.pendingSectionId;
    const next = this.sections.get(nextId);
    this.pendingSectionId = null;
    if (!next) return;
    this.activeSectionId = nextId;
    this.scheduler.start(next.parts, next.bpm); // BPM baru diterapkan seketika (hard cut)
  }
}
