import { describe, expect, it } from 'vitest';
import { SectionPlayer, type SectionDefinition, type SchedulerLike } from './section-player';
import type { ScheduledPart } from './scheduling-math';

class FakeScheduler implements SchedulerLike {
  isPlaying = false;
  startedWith: { parts: ScheduledPart[]; bpm: number; startAt?: number } | null = null;
  stopCalls = 0;
  /** Timestamp terakhir yang diteruskan ke stop (undefined = stop seketika). */
  stopAt: number | undefined = undefined;
  onCycleComplete: ((boundaryTime: number) => void) | null = null;

  start(parts: ScheduledPart[], bpm: number, startAt?: number): void {
    this.isPlaying = true;
    this.startedWith = { parts, bpm, startAt };
  }

  stop(when?: number): void {
    this.isPlaying = false;
    this.stopCalls++;
    this.stopAt = when;
  }

  /** Simulasi selesainya satu siklus dari section yang sedang aktif. */
  fireCycleComplete(boundaryTime: number): void {
    this.onCycleComplete?.(boundaryTime);
  }
}

function def(bpm: number, steps = 'TDTD', loop = true, extra?: Partial<SectionDefinition>): SectionDefinition {
  const buffers = new Map<string, AudioBuffer>([['T', {} as AudioBuffer], ['D', {} as AudioBuffer]]);
  return { parts: [{ steps, buffers }], bpm, loop, ...extra };
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

  it('section "sekali" (loop=false) → akhir siklus lanjut otomatis ke section berikutnya', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2, 3]);

    // Definisi semua section didaftarkan saat lagu disiapkan (prepare).
    player.registerDefinition(2, def(110));
    player.registerDefinition(3, def(120));

    player.trigger(1, def(90, 'TDTD', false)); // awalan — sekali
    expect(player.activeSectionId).toBe(1);
    expect(player.pendingSectionId).toBeNull();

    scheduler.fireCycleComplete(555);
    expect(player.activeSectionId).toBe(2); // lanjut otomatis
    expect(player.pendingSectionId).toBeNull();
    expect(scheduler.startedWith?.bpm).toBe(110);
    expect(scheduler.startedWith?.startAt).toBe(555); // tepat di batas siklus
  });

  it('rantai "sekali" → lanjut terus sampai section diulang atau habis', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2]);

    player.registerDefinition(2, def(110, 'TDTD', false)); // juga sekali
    player.trigger(1, def(90, 'TDTD', false));

    scheduler.fireCycleComplete(100);
    expect(player.activeSectionId).toBe(2);

    scheduler.fireCycleComplete(200);
    // section 2 juga "sekali" dan tidak ada berikutnya → berhenti
    expect(player.activeSectionId).toBeNull();
    expect(scheduler.isPlaying).toBe(false);
  });

  it('section "sekali" tanpa section berikutnya → berhenti', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1]);

    player.trigger(1, def(90, 'TDTD', false));
    scheduler.fireCycleComplete(100);
    expect(player.activeSectionId).toBeNull();
    expect(scheduler.isPlaying).toBe(false);
  });

  it('section diulang (loop=true) tanpa pending → tetap loop, tidak pindah', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2]);
    player.registerDefinition(2, def(110));

    player.trigger(1, def(90, 'TDTD', true));
    scheduler.fireCycleComplete(100);
    expect(player.activeSectionId).toBe(1);
    expect(scheduler.startedWith?.bpm).toBe(90); // tidak ada start baru
  });

  it('section "sekali" dengan nextMode=target → lanjut ke section terpilih (bukan urutan)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2, 3]);

    player.registerDefinition(2, def(100)); // bukan tujuan
    player.registerDefinition(3, def(130)); // tujuan terpilih

    player.trigger(1, def(90, 'TDTD', false, { nextMode: 'target', nextTargetId: 3 }));
    scheduler.fireCycleComplete(777);

    expect(player.activeSectionId).toBe(3);
    expect(scheduler.startedWith?.bpm).toBe(130);
    expect(scheduler.startedWith?.startAt).toBe(777);
  });

  it('section "sekali" dengan nextMode=target yang targetnya hilang → berhenti aman', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2]);

    player.trigger(1, def(90, 'TDTD', false, { nextMode: 'target', nextTargetId: 99 }));
    scheduler.fireCycleComplete(100);

    expect(player.activeSectionId).toBeNull();
    expect(scheduler.isPlaying).toBe(false);
  });

  it('section "sekali" dengan nextMode=end → berhenti (penutup), walau masih ada section berikutnya', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2]);
    player.registerDefinition(2, def(100));

    player.trigger(1, def(90, 'TDTD', false, { nextMode: 'end' }));
    scheduler.fireCycleComplete(100);

    expect(player.activeSectionId).toBeNull();
    expect(scheduler.isPlaying).toBe(false);
    expect(scheduler.stopCalls).toBeGreaterThan(0);
  });

  it('berhenti di akhir siklus → stop DITERUSKAN dengan boundaryTime (ketukan terakhir berbunyi penuh)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1]);

    player.trigger(1, def(90, 'TDTD', false, { nextMode: 'end' }));
    scheduler.fireCycleComplete(1234);

    expect(scheduler.stopAt).toBe(1234); // potong tepat di batas siklus, bukan seketika
  });
});
