import type { ScheduledPart } from './scheduling-math';

/** Mode tujuan setelah Section "sekali" (loop=false) selesai. */
export type NextMode = 'order' | 'target' | 'end';

export interface SectionDefinition {
  parts: ScheduledPart[];
  bpm: number;
  /** false = mainkan SEKALI, lalu lanjut sesuai nextMode. */
  loop: boolean;
  /** order (default) = lanjut ke section berikutnya dalam urutan;
   *  target = lanjut ke nextTargetId; end = berhenti (penutup). */
  nextMode?: NextMode;
  /** Tujuan saat nextMode='target'. */
  nextTargetId?: number;
}

/** Antarmuka minimal scheduler — memudahkan pengujian SectionPlayer. */
export interface SchedulerLike {
  isPlaying: boolean;
  /** startAt opsional: timestamp mulai presisi (dipakai transisi di batas siklus). */
  start(parts: ScheduledPart[], bpm: number, startAt?: number): void;
  /** `when` opsional: potong bunyi berdering tepat di timestamp itu (akhir siklus). */
  stop(when?: number): void;
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
  /** Urutan section dalam Song — dipakai auto-lanjut section "sekali". */
  private playlist: number[] = [];

  activeSectionId: number | null = null;
  pendingSectionId: number | null = null;

  constructor(scheduler: SchedulerLike) {
    this.scheduler = scheduler;
    scheduler.onCycleComplete = (boundaryTime) => this.handleCycleComplete(boundaryTime);
  }

  /** Tetapkan urutan section (by order_index) untuk auto-lanjut. */
  setPlaylist(orderedIds: number[]): void {
    this.playlist = [...orderedIds];
  }

  /** Daftarkan definisi section TANPA memulainya (untuk auto-lanjut section "sekali"). */
  registerDefinition(sectionId: number, definition: SectionDefinition): void {
    this.sections.set(sectionId, definition);
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
    if (this.pendingSectionId != null) {
      const nextId = this.pendingSectionId;
      const next = this.sections.get(nextId);
      this.pendingSectionId = null;
      if (!next) return;
      this.activeSectionId = nextId;
      // Section baru dimulai TEPAT di timestamp batas siklus section lama —
      // bukan lebih awal (quantized trigger presisi, FR-PLAY-04). BPM baru
      // diterapkan seketika pada langkah pertamanya (hard cut, FR-PLAY-11).
      this.scheduler.start(next.parts, next.bpm, boundaryTime);
      return;
    }

    const activeId = this.activeSectionId;
    if (activeId == null) return;
    const definition = this.sections.get(activeId);
    if (!definition || definition.loop) return; // section diulang — loop alami

    const mode: NextMode = definition.nextMode ?? 'order';

    // Ending/penutup: berhenti setelah section selesai. Pemotongan bunyi
    // dijadwalkan TEPAT di batas siklus (bukan seketika) agar ketukan terakhir
    // berbunyi penuh sampai akhir pola.
    if (mode === 'end') {
      this.scheduler.stop(boundaryTime);
      this.activeSectionId = null;
      this.pendingSectionId = null;
      return;
    }

    // Tujuan khusus: lanjut langsung ke section yang dipilih user.
    if (mode === 'target') {
      const next =
        definition.nextTargetId != null ? this.sections.get(definition.nextTargetId) : undefined;
      if (!next) {
        // Target hilang (terhapus) → aman: berhenti di batas siklus.
        this.scheduler.stop(boundaryTime);
        this.activeSectionId = null;
        this.pendingSectionId = null;
        return;
      }
      this.activeSectionId = definition.nextTargetId as number;
      this.pendingSectionId = null;
      this.scheduler.start(next.parts, next.bpm, boundaryTime);
      return;
    }

    // mode 'order': lanjut otomatis ke section berikutnya dalam urutan.
    const index = this.playlist.indexOf(activeId);
    const nextId = index >= 0 ? this.playlist[index + 1] : undefined;
    const next = nextId != null ? this.sections.get(nextId) : undefined;
    if (!next) {
      // Tidak ada section berikutnya → berhenti di batas siklus (ketukan
      // terakhir tetap berbunyi penuh).
      this.scheduler.stop(boundaryTime);
      this.activeSectionId = null;
      this.pendingSectionId = null;
      return;
    }
    this.activeSectionId = nextId as number; // next ada → nextId pasti terdefinisi
    this.pendingSectionId = null;
    this.scheduler.start(next.parts, next.bpm, boundaryTime);
  }
}
