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
  /** Sumber audio yang sedang berbunyi, per identitas Part. */
  private activeSources = new Map<string, AudioBufferSourceNode>();

  /** Dipanggil tepat saat satu siklus Section selesai (untuk quantized trigger). */
  onCycleComplete: (() => void) | null = null;

  constructor(private ctx: AudioContext) {}

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Posisi step saat ini dalam siklus Section aktif (untuk indikator, FR-PLAY-08). */
  get currentStep(): number {
    return this.stepIndex;
  }

  /** Mulai memutar section baru dari langkah 0 — bunyi lama dipotong (choke). */
  start(parts: ScheduledPart[], bpm: number): void {
    this.parts = parts;
    this.bpm = bpm;
    this.stepIndex = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.playing = true;
    this.chokeAll();
  }

  /** Panggil tiap tick dari clock worker. */
  tick(): void {
    if (!this.playing) return;

    const stepDur = stepDurationSeconds(this.bpm);
    const lookaheadSec = LOOKAHEAD_MS / 1000;
    const totalLen = cycleLength(this.parts);
    if (totalLen === 0) return;

    while (this.nextNoteTime < this.ctx.currentTime + lookaheadSec) {
      this.scheduleStep(this.stepIndex, this.nextNoteTime);
      this.nextNoteTime += stepDur;
      this.stepIndex++;

      if (this.stepIndex >= totalLen) {
        this.stepIndex = 0;
        this.onCycleComplete?.();
      }
    }
  }

  /** Hentikan penjadwalan dan potong semua bunyi yang masih berbunyi. */
  stop(): void {
    this.playing = false;
    this.parts = [];
    this.chokeAll();
  }

  /** Potong semua sumber audio aktif (dipakai saat stop / ganti section). */
  private chokeAll(): void {
    for (const source of this.activeSources.values()) {
      try {
        source.stop();
      } catch {
        // Sumber sudah berhenti sendiri — abaikan.
      }
    }
    this.activeSources.clear();
  }

  private scheduleStep(index: number, when: number): void {
    for (const { part, buffer } of stepKeysAt(this.parts, index)) {
      if (!buffer) continue; // step senyap — SoundSlot tanpa sample (FR-PLAY-09, AC-5)
      if (part) {
        // Choke monofonik: bunyi baru part ini memotong bunyi sebelumnya
        // tepat di titik bunyi baru dimulai.
        const previous = this.activeSources.get(part);
        if (previous) {
          try {
            previous.stop(when);
          } catch {
            // Sumber sudah berhenti — abaikan.
          }
        }
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(when);
      if (part) {
        source.onended = () => {
          if (this.activeSources.get(part) === source) {
            this.activeSources.delete(part);
          }
        };
        this.activeSources.set(part, source);
      }
    }
  }
}
