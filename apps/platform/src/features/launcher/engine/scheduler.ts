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
 */
export class Scheduler {
  private parts: ScheduledPart[] = [];
  private bpm = 90;
  private stepIndex = 0;
  private nextNoteTime = 0;
  private playing = false;

  /** Dipanggil tepat saat satu siklus Section selesai (untuk quantized trigger). */
  onCycleComplete: (() => void) | null = null;

  constructor(private ctx: AudioContext) {}

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Mulai memutar section baru dari langkah 0. */
  start(parts: ScheduledPart[], bpm: number): void {
    this.parts = parts;
    this.bpm = bpm;
    this.stepIndex = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.playing = true;
  }

  /**
   * Ganti BPM seketika (hard cut — FR-PLAY-11): berlaku mulai step berikutnya
   * yang dijadwalkan, tanpa interpolasi.
   */
  setBpm(bpm: number): void {
    this.bpm = bpm;
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

  /** Hentikan penjadwalan (sumber audio yang sudah start akan habis dengan sendirinya). */
  stop(): void {
    this.playing = false;
    this.parts = [];
  }

  private scheduleStep(index: number, when: number): void {
    for (const { buffer } of stepKeysAt(this.parts, index)) {
      if (!buffer) continue; // step senyap — SoundSlot tanpa sample (FR-PLAY-09, AC-5)
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(when);
    }
  }
}
