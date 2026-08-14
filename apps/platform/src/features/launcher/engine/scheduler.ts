import {
  cycleLength,
  stepDurationSeconds,
  stepKeysAt,
  type ScheduledPart,
} from './scheduling-math';

// Lookahead window (ms) — berapa jauh ke depan step dijadwalkan ke AudioContext.
const LOOKAHEAD_MS = 100;

/**
 * Scheduler lookahead berbasis AudioContext (FR-PLAY-05): setiap tick (dari
 * clock worker) menjadwalkan semua step yang jatuh dalam window berikutnya
 * dengan timestamp presisi — playback tidak drift walau tab tidak fokus.
 *
 * Choke monofonik per Part: tiap Part adalah satu instrumen fisik — bunyi baru
 * pada part yang sama memotong bunyi sebelumnya (perilaku standar drum
 * machine). Ini mencegah ekor sample panjang menumpuk dan mengotori downbeat
 * saat pola mengulang.
 */
export class Scheduler {
  private parts: ScheduledPart[] = [];
  private bpm = 90;
  private stepIndex = 0;
  private nextNoteTime = 0;
  private playing = false;
  /** Sumber audio yang sedang berbunyi, per identitas Part (bisa lebih dari satu saat multi-bunyi sekolom). */
  private activeSources = new Map<string, AudioBufferSourceNode[]>();

  /** Dipanggil tepat saat satu siklus Section selesai (untuk quantized trigger).
   *  Parameter = timestamp batas siklus (kapan langkah pertama siklus berikutnya jatuh). */
  onCycleComplete: ((boundaryTime: number) => void) | null = null;

  constructor(private ctx: AudioContext) {}

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Posisi step saat ini dalam siklus Section aktif (untuk indikator, FR-PLAY-08). */
  get currentStep(): number {
    return this.stepIndex;
  }

  /**
   * Mulai memutar section baru dari langkah 0 — bunyi lama dipotong (choke).
   * `startAt` opsional: bila disediakan (transisi quantized), langkah pertama
   * dijadwalkan tepat di timestamp itu dan bunyi lama dipotong TEPAT di titik
   * itu juga — tanpa jeda senyap sebelum batas siklus.
   */
  start(parts: ScheduledPart[], bpm: number, startAt?: number): void {
    this.parts = parts;
    this.bpm = bpm;
    this.stepIndex = 0;
    this.nextNoteTime = startAt ?? this.ctx.currentTime + 0.05;
    this.playing = true;
    // startAt = batas siklus: potong bunyi lama pas di titik itu; start biasa
    // (tanpa startAt): potong seketika.
    this.chokeAll(startAt);
  }

  /** Panggil tiap tick dari clock worker. */
  tick(): void {
    if (!this.playing) return;

    const lookaheadSec = LOOKAHEAD_MS / 1000;
    const totalLen = cycleLength(this.parts);
    if (totalLen === 0) return;

    while (this.playing && this.nextNoteTime < this.ctx.currentTime + lookaheadSec) {
      // stepDur dihitung per iterasi — BPM bisa berubah di tengah loop saat
      // transisi quantized (hard cut) terjadi via onCycleComplete.
      const stepDur = stepDurationSeconds(this.bpm);
      this.scheduleStep(this.stepIndex, this.nextNoteTime);
      this.nextNoteTime += stepDur;
      this.stepIndex++;

      if (this.stepIndex >= totalLen) {
        this.stepIndex = 0;
        // nextNoteTime saat ini = timestamp batas siklus (langkah pertama
        // siklus berikutnya) — teruskan agar transisi quantized presisi.
        this.onCycleComplete?.(this.nextNoteTime);
      }
    }
  }

  /**
   * Hentikan penjadwalan. `when` opsional: bila diberikan (akhir siklus),
   * bunyi yang sedang berdering dipotong TEPAT di timestamp itu — bukan
   * seketika — agar ketukan terakhir berbunyi penuh sampai batas siklus.
   */
  stop(when?: number): void {
    this.playing = false;
    this.parts = [];
    this.chokeAll(when);
  }

  /**
   * Potong sumber audio aktif. `when` opsional: bila diberikan, pemotongan
   * dijadwalkan tepat di timestamp itu (dipakai transisi quantized agar bunyi
   * lama berbunyi penuh sampai batas siklus, tanpa jeda).
   */
  private chokeAll(when?: number): void {
    for (const sources of this.activeSources.values()) {
      for (const source of sources) {
        try {
          if (when !== undefined) source.stop(when);
          else source.stop();
        } catch {
          // Sumber sudah berhenti sendiri — abaikan.
        }
      }
    }
    this.activeSources.clear();
  }

  private scheduleStep(index: number, when: number): void {
    // Choke per Part cukup sekali per step — bunyi baru part ini memotong SEMUA
    // bunyi lama part yang sama tepat di titik bunyi baru dimulai.
    const choked = new Set<string>();
    for (const { part, buffer } of stepKeysAt(this.parts, index)) {
      if (!buffer) continue; // step senyap — SoundSlot tanpa sample (FR-PLAY-09, AC-5)
      if (part && !choked.has(part)) {
        const previous = this.activeSources.get(part);
        if (previous) {
          for (const source of previous) {
            try {
              source.stop(when);
            } catch {
              // Sumber sudah berhenti — abaikan.
            }
          }
        }
        this.activeSources.set(part, []);
        choked.add(part);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(when);
      if (part) {
        source.onended = () => {
          const sources = this.activeSources.get(part);
          if (sources) {
            const i = sources.indexOf(source);
            if (i >= 0) sources.splice(i, 1);
          }
        };
        const sources = this.activeSources.get(part) ?? [];
        sources.push(source);
        this.activeSources.set(part, sources);
      }
    }
  }
}
