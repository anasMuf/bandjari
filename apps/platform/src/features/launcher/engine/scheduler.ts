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
    for (const sources of this.activeSources.values()) {
      for (const source of sources) {
        try {
          source.stop();
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
