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

/**
 * Satu baris antrian Launcher. Antrian PERSISTEN — baris tidak dihapus saat
 * dimainkan (preferensi produk); `cursor` menandai baris yang sedang/akan
 * dimainkan, dan baris di bawah cursor adalah riwayat.
 */
export interface QueueRow {
  sectionId: number;
  /** Jumlah pengulangan saat diputar dari antrian; Infinity = ∞ (ikuti setting section). */
  loopCount: number;
}

/** Batas atas nilai loop count finite pada stepper UI (∞ menangani kasus tanpa batas). */
export const MAX_FINITE_LOOP = 8;

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
 * State machine playback per Section dengan quantized trigger (FR-PLAY-04) dan
 * DUA MODE:
 *
 * - Mode Biasa (default, antrian kosong): perilaku awal pra-antrian — klik pad
 *   saat ada yang main = pending single-slot (quantized jump di akhir siklus),
 *   auto-lanjut section "sekali" langsung via next_mode TANPA append.
 * - Mode Antrian (aktif bila antrian tidak kosong — dipicu tombol +):
 *   queue-first di tiap akhir siklus, baris persisten + cursor, loop count per
 *   baris, tujuan next_mode otomatis masuk antrian (dedup: lompat ke kemunculan
 *   pertama bila sudah ada). Keluar mode = antrian dikosongkan (hapus satu per
 *   satu atau bersihkan semua) — antrian < 1 berarti kembali ke Mode Biasa.
 *
 * Pindah Section tidak langsung terjadi — menunggu akhir siklus Section aktif,
 * lalu Section baru mulai dengan BPM efektifnya seketika (hard cut, FR-PLAY-11).
 */
export class SectionPlayer {
  private sections = new Map<number, SectionDefinition>();
  private scheduler: SchedulerLike;
  /** Urutan section dalam Song — dipakai auto-lanjut section "sekali". */
  private playlist: number[] = [];

  /** Antrian section — persisten (baris tidak dihapus saat dimainkan). */
  queue: QueueRow[] = [];
  /** Indeks baris yang sedang/akan dimainkan; -1 = kosong/exhausted. */
  cursor = -1;

  activeSectionId: number | null = null;

  /** Sisa pengulangan baris cursor yang sedang dimainkan (∞ = tanpa batas). */
  private remaining = 0;
  /** Mode Biasa: section yang menunggu akhir siklus (single-slot, pra-antrian). */
  private pending: number | null = null;

  constructor(scheduler: SchedulerLike) {
    this.scheduler = scheduler;
    scheduler.onCycleComplete = (boundaryTime) => this.handleCycleComplete(boundaryTime);
  }

  /** Mode Antrian aktif bila antrian tidak kosong; antrian < 1 = Mode Biasa. */
  get queueMode(): boolean {
    return this.queue.length > 0;
  }

  /** Tetapkan urutan section (by order_index) untuk auto-lanjut. */
  setPlaylist(orderedIds: number[]): void {
    this.playlist = [...orderedIds];
  }

  /** Daftarkan definisi section TANPA memulainya (untuk auto-lanjut & antrian). */
  registerDefinition(sectionId: number, definition: SectionDefinition): void {
    this.sections.set(sectionId, definition);
  }

  /**
   * Trigger pad Section: mulai bila idle, restart bila section aktif yang sama.
   * Section lain sedang main → Mode Antrian: append; Mode Biasa: pending jump.
   */
  trigger(sectionId: number, definition: SectionDefinition): void {
    this.sections.set(sectionId, definition);
    if (!this.scheduler.isPlaying) {
      this.activeSectionId = sectionId;
      this.pending = null;
      if (this.cursorInRange() && this.queue[this.cursor].sectionId === sectionId) {
        this.remaining = this.queue[this.cursor].loopCount;
      }
      this.scheduler.start(definition.parts, definition.bpm);
    } else if (sectionId === this.activeSectionId) {
      // Re-trigger section aktif → mulai ulang; reset countdown baris antrian bila ada.
      this.scheduler.start(definition.parts, definition.bpm);
      if (this.cursorInRange() && this.queue[this.cursor].sectionId === sectionId) {
        this.remaining = this.queue[this.cursor].loopCount;
      }
    } else if (this.queueMode) {
      this.enqueue(sectionId, definition);
    } else {
      this.pending = sectionId; // Mode Biasa — tunggu akhir siklus (single-slot)
    }
  }

  /**
   * Tambahkan section ke AKHIR antrian (append-only). Default loop count
   * mengikuti setting section: loop=true → ∞, sekali → 1.
   *
   * Bila baris cursor sedang dimainkan (∞ atau count belum habis) dan user
   * menambah section lain, cursor MAJU melewati baris itu — "pilih section
   * selanjutnya" berarti pindah ke antrian di akhir siklus (queue-first).
   */
  enqueue(sectionId: number, definition: SectionDefinition): void {
    this.sections.set(sectionId, definition);
    this.pending = null; // beralih ke Mode Antrian — pending single-slot dibuang
    this.queue.push({ sectionId, loopCount: definition.loop ? Infinity : 1 });
    if (this.cursorInRange() && this.queue[this.cursor].sectionId === this.activeSectionId) {
      this.cursor = Math.min(this.cursor + 1, this.queue.length - 1);
    }
    if (this.cursor < 0) {
      this.cursor = this.queue.length - 1;
    }
  }

  /** Ubah jumlah loop satu baris; berlaku seketika bila baris sedang dimainkan. */
  setLoopCount(index: number, loopCount: number): void {
    if (index < 0 || index >= this.queue.length) return;
    this.queue[index].loopCount = loopCount;
    if (index === this.cursor && this.queue[index].sectionId === this.activeSectionId) {
      this.remaining = loopCount;
    }
  }

  /** Hapus baris; cursor menunjuk penggantinya bila baris cursor dihapus. */
  removeRow(index: number): void {
    if (index < 0 || index >= this.queue.length) return;
    this.queue.splice(index, 1);
    if (index === this.cursor) {
      this.cursor = index < this.queue.length ? index : -1;
      this.remaining = 0; // boundary berikutnya lompat/fallback
    } else if (index < this.cursor) {
      this.cursor--;
    }
  }

  /** Pindahkan baris; cursor mengikuti baris yang sama. */
  moveRow(from: number, to: number): void {
    if (from === to) return;
    if (from < 0 || from >= this.queue.length || to < 0 || to >= this.queue.length) return;
    const [row] = this.queue.splice(from, 1);
    this.queue.splice(to, 0, row);
    if (this.cursor === from) {
      this.cursor = to;
    } else if (from < to && this.cursor > from && this.cursor <= to) {
      this.cursor--;
    } else if (from > to && this.cursor >= to && this.cursor < from) {
      this.cursor++;
    }
  }

  stop(): void {
    this.scheduler.stop();
    this.activeSectionId = null;
    this.pending = null;
    this.remaining = 0;
  }

  /** Kosongkan antrian → kembali ke Mode Biasa (antrian < 1 = nonaktif). */
  clearQueue(): void {
    this.queue = [];
    this.cursor = -1;
    this.remaining = 0;
    this.pending = null;
  }

  /**
   * Tombol Play: mulai playback mengikuti antrian dari baris cursor. Bila
   * cursor sudah lewat ujung (semua baris dimainkan), mulai lagi dari baris
   * pertama. Mengembalikan false bila antrian kosong atau barisnya tidak
   * tersedia (hook kemudian fallback ke section urutan pertama).
   */
  playFromQueue(): boolean {
    if (this.queue.length === 0) return false;
    if (!this.cursorInRange()) this.cursor = 0;
    const row = this.queue[this.cursor];
    const definition = this.sections.get(row.sectionId);
    if (!definition) return false;
    this.activeSectionId = row.sectionId;
    this.remaining = row.loopCount;
    this.scheduler.start(definition.parts, definition.bpm);
    return true;
  }

  /**
   * Section yang "menunggu akhir siklus": Mode Antrian = baris cursor yang
   * belum aktif; Mode Biasa = pending single-slot.
   */
  get pendingSectionId(): number | null {
    if (this.queueMode) {
      if (!this.scheduler.isPlaying || !this.cursorInRange()) return null;
      const row = this.queue[this.cursor];
      return row.sectionId === this.activeSectionId ? null : row.sectionId;
    }
    return this.pending;
  }

  private cursorInRange(): boolean {
    return this.cursor >= 0 && this.cursor < this.queue.length;
  }

  /** Majukan cursor; di luar ujung antrian dinormalisasi ke -1 (exhausted). */
  private advanceCursor(): void {
    this.cursor++;
    if (this.cursor >= this.queue.length) this.cursor = -1;
  }

  /** Append tujuan auto-lanjut (next_mode) ke antrian & langsung dimainkan. */
  private appendAutoTarget(sectionId: number, boundaryTime: number): void {
    const definition = this.sections.get(sectionId);
    if (!definition) return;
    this.queue.push({ sectionId, loopCount: definition.loop ? Infinity : 1 });
    this.cursor = this.queue.length - 1;
    this.remaining = this.queue[this.cursor].loopCount;
    this.activeSectionId = sectionId;
    this.scheduler.start(definition.parts, definition.bpm, boundaryTime);
  }

  /**
   * Resolusi auto-advance (next_mode) saat antrian exhausted: cek dulu apakah
   * section tujuan SUDAH ada di antrian — bila ya, cursor lompat ke kemunculan
   * pertamanya (loop kembali, tanpa duplikasi); bila belum, baru append.
   */
  private resolveAutoTarget(sectionId: number, boundaryTime: number): void {
    const definition = this.sections.get(sectionId);
    if (!definition) return;
    const existingIndex = this.queue.findIndex((row) => row.sectionId === sectionId);
    if (existingIndex >= 0) {
      this.cursor = existingIndex;
      this.remaining = this.queue[existingIndex].loopCount;
      this.activeSectionId = sectionId;
      this.scheduler.start(definition.parts, definition.bpm, boundaryTime);
      return;
    }
    this.appendAutoTarget(sectionId, boundaryTime);
  }

  private handleCycleComplete(boundaryTime: number): void {
    if (this.queueMode) {
      this.handleQueueCycleComplete(boundaryTime);
    } else {
      this.handleNormalCycleComplete(boundaryTime);
    }
  }

  /** Mode Biasa — logika awal pra-antrian: pending jump + next_mode langsung. */
  private handleNormalCycleComplete(boundaryTime: number): void {
    if (this.pending != null) {
      const nextId = this.pending;
      const next = this.sections.get(nextId);
      this.pending = null;
      if (!next) return;
      this.activeSectionId = nextId;
      // Quantized trigger presisi (FR-PLAY-04) + hard cut BPM (FR-PLAY-11).
      this.scheduler.start(next.parts, next.bpm, boundaryTime);
      return;
    }

    const activeId = this.activeSectionId;
    if (activeId == null) return;
    const definition = this.sections.get(activeId);
    if (!definition || definition.loop) return; // section diulang — loop alami

    const mode: NextMode = definition.nextMode ?? 'order';

    // Ending/penutup: berhenti setelah section selesai (ketukan terakhir penuh).
    if (mode === 'end') {
      this.scheduler.stop(boundaryTime);
      this.activeSectionId = null;
      return;
    }

    // Tujuan khusus: lanjut langsung ke section yang dipilih user (TANPA append).
    let targetId: number | undefined;
    if (mode === 'target') {
      targetId = definition.nextTargetId;
    } else {
      const index = this.playlist.indexOf(activeId);
      targetId = index >= 0 ? this.playlist[index + 1] : undefined;
    }
    const next = targetId != null ? this.sections.get(targetId) : undefined;
    if (!next) {
      // Target hilang / tidak ada section berikutnya → berhenti di batas siklus.
      this.scheduler.stop(boundaryTime);
      this.activeSectionId = null;
      return;
    }
    this.activeSectionId = targetId as number;
    this.scheduler.start(next.parts, next.bpm, boundaryTime);
  }

  /** Mode Antrian — queue-first: baris cursor, loop count, fallback next_mode + auto-append. */
  private handleQueueCycleComplete(boundaryTime: number): void {
    // (a) Baris antrian yang sedang dimainkan — hitung sisa loop count.
    if (this.cursorInRange() && this.activeSectionId === this.queue[this.cursor].sectionId) {
      if (this.remaining === Infinity) return;
      this.remaining--;
      if (this.remaining > 0) return;
      this.advanceCursor(); // count habis → lanjut ke baris berikutnya
    }

    // (b) Queue-first: baris cursor (baru / belum aktif) → lompat di batas siklus.
    while (this.cursorInRange()) {
      const row = this.queue[this.cursor];
      const next = this.sections.get(row.sectionId);
      if (!next) {
        this.cursor++; // baris menunjuk section tak terdaftar → lewati (defensif)
        continue;
      }
      this.activeSectionId = row.sectionId;
      this.remaining = row.loopCount;
      // Section baru dimulai TEPAT di timestamp batas siklus section lama —
      // bukan lebih awal (quantized trigger presisi, FR-PLAY-04). BPM baru
      // diterapkan seketika pada langkah pertamanya (hard cut, FR-PLAY-11).
      this.scheduler.start(next.parts, next.bpm, boundaryTime);
      return;
    }

    // (c) Antrian kosong/exhausted → fallback next_mode section aktif.
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
      this.remaining = 0;
      return;
    }

    // Tujuan khusus: lanjut langsung ke section yang dipilih user —
    // otomatis DI-APPEND ke antrian (tujuan lanjut tiap section ditambahkan).
    if (mode === 'target') {
      const targetId = definition.nextTargetId;
      if (targetId == null || !this.sections.has(targetId)) {
        // Target hilang (terhapus) → aman: berhenti di batas siklus.
        this.scheduler.stop(boundaryTime);
        this.activeSectionId = null;
        this.remaining = 0;
        return;
      }
      this.resolveAutoTarget(targetId, boundaryTime);
      return;
    }

    // mode 'order': lanjut otomatis ke section berikutnya dalam urutan.
    const index = this.playlist.indexOf(activeId);
    const nextId = index >= 0 ? this.playlist[index + 1] : undefined;
    if (nextId == null || !this.sections.has(nextId)) {
      // Tidak ada section berikutnya → berhenti di batas siklus (ketukan
      // terakhir tetap berbunyi penuh).
      this.scheduler.stop(boundaryTime);
      this.activeSectionId = null;
      this.remaining = 0;
      return;
    }
    this.resolveAutoTarget(nextId, boundaryTime);
  }
}
