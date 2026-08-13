import { describe, expect, it } from 'vitest';
import { SectionPlayer, type SectionDefinition, type SchedulerLike } from './section-player';
import type { ScheduledPart } from './scheduling-math';

class FakeScheduler implements SchedulerLike {
  isPlaying = false;
  startedWith: { parts: ScheduledPart[]; bpm: number; startAt?: number } | null = null;
  stopCalls = 0;
  onCycleComplete: ((boundaryTime: number) => void) | null = null;

  start(parts: ScheduledPart[], bpm: number, startAt?: number): void {
    this.isPlaying = true;
    this.startedWith = { parts, bpm, startAt };
  }

  stop(): void {
    this.isPlaying = false;
    this.stopCalls++;
  }

  /** Simulasi selesainya satu siklus dari section yang sedang aktif. */
  fireCycleComplete(boundaryTime: number): void {
    this.onCycleComplete?.(boundaryTime);
  }
}

function def(bpm: number, steps = 'TDTD'): SectionDefinition {
  const buffers = new Map<string, AudioBuffer>([['T', {} as AudioBuffer], ['D', {} as AudioBuffer]]);
  return { parts: [{ steps, buffers }], bpm };
}

describe('SectionPlayer (quantized trigger)', () => {
  it('trigger saat idle → langsung mulai section tsb', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    expect(player.activeSectionId).toBe(1);
    expect(player.pendingSectionId).toBeNull();
    expect(scheduler.startedWith?.bpm).toBe(90);
  });

  it('trigger section lain saat aktif → antre (quantized), tidak langsung pindah (AC-4)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.trigger(2, def(110));
    expect(player.activeSectionId).toBe(1); // masih section 1
    expect(player.pendingSectionId).toBe(2); // section 2 menunggu
    expect(scheduler.startedWith?.bpm).toBe(90);
  });

  it('akhir siklus dengan pending → pindah section TEPAT di batas siklus + BPM baru seketika (hard cut, AC-9)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(70));
    player.trigger(2, def(110));
    scheduler.fireCycleComplete(123.456);

    expect(player.activeSectionId).toBe(2);
    expect(player.pendingSectionId).toBeNull();
    expect(scheduler.startedWith?.bpm).toBe(110);
    // Section baru dimulai tepat di timestamp batas siklus section lama —
    // bukan lebih awal (quantized trigger presisi, FR-PLAY-04).
    expect(scheduler.startedWith?.startAt).toBe(123.456);
  });

  it('akhir siklus tanpa pending → tetap pada section aktif', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    scheduler.fireCycleComplete(42);
    expect(player.activeSectionId).toBe(1);
    expect(scheduler.startedWith?.bpm).toBe(90);
  });

  it('re-trigger section aktif → mulai ulang dari awal', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.trigger(1, def(90));
    expect(player.activeSectionId).toBe(1);
    expect(player.pendingSectionId).toBeNull();
  });

  it('stop → reset state & hentikan scheduler (FR-PLAY-06)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.trigger(2, def(110));
    player.stop();
    expect(player.activeSectionId).toBeNull();
    expect(player.pendingSectionId).toBeNull();
    expect(scheduler.isPlaying).toBe(false);
  });
});
