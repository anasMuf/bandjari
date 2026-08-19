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

describe('SectionPlayer (trigger langsung)', () => {
  it('trigger saat idle → langsung mulai section tsb, tanpa menyentuh antrian', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    expect(player.activeSectionId).toBe(1);
    expect(player.pendingSectionId).toBeNull();
    expect(player.queue).toEqual([]);
    expect(player.cursor).toBe(-1);
    expect(scheduler.startedWith?.bpm).toBe(90);
  });

  it('re-trigger section aktif → mulai ulang dari awal, antrian tidak berubah', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', false));
    player.trigger(1, def(90));
    expect(player.activeSectionId).toBe(1);
    expect(player.queue).toEqual([{ sectionId: 2, loopCount: 1 }]);
    expect(scheduler.startedWith?.bpm).toBe(90);
  });

  it('stop → reset state playback, antrian TETAP UTUH (daftar tidak hilang)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', false));
    player.stop();
    expect(player.activeSectionId).toBeNull();
    expect(player.pendingSectionId).toBeNull();
    expect(player.queue).toEqual([{ sectionId: 2, loopCount: 1 }]);
    expect(player.cursor).toBe(0);
    expect(scheduler.isPlaying).toBe(false);
  });
});

describe('SectionPlayer (antrian — append & queue-first)', () => {
  it('enqueue saat section lain main → masuk antrian, section aktif tidak berubah (quantized)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', false));
    expect(player.activeSectionId).toBe(1); // masih section 1
    expect(player.pendingSectionId).toBe(2); // baris cursor = berikutnya
    expect(player.queue).toEqual([{ sectionId: 2, loopCount: 1 }]);
    expect(scheduler.startedWith?.bpm).toBe(90);
  });

  it('akhir siklus dengan baris antrian → pindah TEPAT di batas siklus + BPM baru seketika (hard cut)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(70));
    player.enqueue(2, def(110, 'TDTD', false));
    scheduler.fireCycleComplete(123.456);

    expect(player.activeSectionId).toBe(2);
    expect(player.pendingSectionId).toBeNull();
    expect(scheduler.startedWith?.bpm).toBe(110);
    expect(scheduler.startedWith?.startAt).toBe(123.456);
  });

  it('akhir siklus tanpa antrian & section loop → tetap pada section aktif', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    scheduler.fireCycleComplete(42);
    expect(player.activeSectionId).toBe(1);
    expect(scheduler.startedWith?.bpm).toBe(90);
  });

  it('append saat baris cursor sedang main (count belum habis) → cursor maju melewatinya', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', false));
    scheduler.fireCycleComplete(100); // baris 2 mulai (count 1)
    expect(player.activeSectionId).toBe(2);

    player.enqueue(3, def(120, 'TDTD', false)); // aksi pilih section lain → append
    expect(player.queue).toEqual([
      { sectionId: 2, loopCount: 1 },
      { sectionId: 3, loopCount: 1 },
    ]);
    expect(player.cursor).toBe(1); // lewati baris 2 yang sedang main

    scheduler.fireCycleComplete(200);
    expect(player.activeSectionId).toBe(3); // queue-first di akhir siklus
    expect(scheduler.startedWith?.startAt).toBe(200);
  });

  it('append saat baris ∞ sedang main → cursor maju ke baris baru, ∞ tidak menahan selamanya', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', true)); // loop → default ∞
    scheduler.fireCycleComplete(100);
    expect(player.activeSectionId).toBe(2);

    scheduler.fireCycleComplete(200); // ∞ → tetap di baris 2
    expect(player.activeSectionId).toBe(2);

    player.enqueue(3, def(120, 'TDTD', false));
    expect(player.cursor).toBe(1);

    scheduler.fireCycleComplete(300);
    expect(player.activeSectionId).toBe(3);
    expect(player.pendingSectionId).toBeNull();
  });

  it('append di tengah antrian (cursor menunjuk baris lain) → baris baru menunggu giliran', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', false));
    player.enqueue(3, def(120, 'TDTD', false));
    player.enqueue(4, def(130, 'TDTD', false));

    expect(player.queue.map((r) => r.sectionId)).toEqual([2, 3, 4]);
    expect(player.cursor).toBe(0);
    expect(player.pendingSectionId).toBe(2);

    scheduler.fireCycleComplete(100);
    expect(player.activeSectionId).toBe(2); // bukan 4 — FIFO
  });
});

describe('SectionPlayer (loop count per baris)', () => {
  it('baris dengan loopCount=2 → dua siklus, lalu lanjut ke baris berikutnya', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2, 3]);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', false));
    player.setLoopCount(0, 2);
    player.enqueue(3, def(120, 'TDTD', false));

    scheduler.fireCycleComplete(100);
    expect(player.activeSectionId).toBe(2);
    scheduler.fireCycleComplete(200);
    expect(player.activeSectionId).toBe(2); // siklus ke-2
    scheduler.fireCycleComplete(300);
    expect(player.activeSectionId).toBe(3); // count habis → baris berikutnya
    expect(scheduler.startedWith?.startAt).toBe(300);
  });

  it('setLoopCount saat baris sedang main → berlaku seketika (sisa count direset)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2]);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', false));
    scheduler.fireCycleComplete(100);
    expect(player.activeSectionId).toBe(2); // count 1

    player.setLoopCount(0, 3); // override saat pemutaran
    scheduler.fireCycleComplete(200);
    expect(player.activeSectionId).toBe(2);
    scheduler.fireCycleComplete(300);
    expect(player.activeSectionId).toBe(2);
    scheduler.fireCycleComplete(400); // 3 siklus selesai → cursor habis → fallback stop
    expect(player.activeSectionId).toBeNull();
    expect(scheduler.isPlaying).toBe(false);
  });
});

describe('SectionPlayer (hapus & reorder antrian)', () => {
  it('removeRow setelah cursor → tidak memengaruhi cursor; sebelum cursor → cursor bergeser', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', false));
    player.enqueue(3, def(120, 'TDTD', false));
    player.enqueue(4, def(130, 'TDTD', false));

    player.removeRow(2); // baris 4 di belakang cursor
    expect(player.queue.map((r) => r.sectionId)).toEqual([2, 3]);
    expect(player.cursor).toBe(0);

    player.removeRow(0); // baris cursor (2) — belum main
    expect(player.queue.map((r) => r.sectionId)).toEqual([3]);
    expect(player.cursor).toBe(0); // menunjuk penggantinya

    player.removeRow(0);
    expect(player.queue).toEqual([]);
    expect(player.cursor).toBe(-1);
    expect(player.pendingSectionId).toBeNull();
  });

  it('moveRow → cursor mengikuti baris yang sama', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', false));
    player.enqueue(3, def(120, 'TDTD', false));
    player.enqueue(4, def(130, 'TDTD', false));

    player.moveRow(0, 2); // baris 2 pindah ke posisi 3
    expect(player.queue.map((r) => r.sectionId)).toEqual([3, 4, 2]);
    expect(player.cursor).toBe(2); // ikut baris 2

    player.moveRow(0, 1); // baris 3 pindah mundur — cursor di posisi 2 tidak berubah
    expect(player.queue.map((r) => r.sectionId)).toEqual([4, 3, 2]);
    expect(player.cursor).toBe(2);

    player.moveRow(2, 0); // baris 2 kembali ke depan
    expect(player.queue.map((r) => r.sectionId)).toEqual([2, 4, 3]);
    expect(player.cursor).toBe(0);
  });
});

describe('SectionPlayer (fallback next_mode — tujuan lanjut auto-append)', () => {
  it('MODE BIASA: section "sekali" + antrian kosong → lanjut order TANPA append', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2, 3]);
    player.registerDefinition(2, def(110, 'TDTD', false));
    player.registerDefinition(3, def(120, 'TDTD', false));

    player.trigger(1, def(90, 'TDTD', false));
    scheduler.fireCycleComplete(555);

    expect(player.queue).toEqual([]); // TIDAK di-append (mode biasa)
    expect(player.activeSectionId).toBe(2);
    expect(scheduler.startedWith?.bpm).toBe(110);
    expect(scheduler.startedWith?.startAt).toBe(555);
  });

  it('MODE BIASA: rantai "sekali" → lanjut terus sampai habis, antrian tetap kosong', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2]);
    player.registerDefinition(2, def(110, 'TDTD', false));

    player.trigger(1, def(90, 'TDTD', false));
    scheduler.fireCycleComplete(100);
    expect(player.activeSectionId).toBe(2);

    scheduler.fireCycleComplete(200);
    expect(player.activeSectionId).toBeNull();
    expect(scheduler.isPlaying).toBe(false);
    expect(player.queue).toEqual([]); // tanpa append
  });

  it('MODE BIASA: nextMode=target → lanjut langsung TANPA append', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2, 3]);
    player.registerDefinition(2, def(100));
    player.registerDefinition(3, def(130));

    player.trigger(1, def(90, 'TDTD', false, { nextMode: 'target', nextTargetId: 3 }));
    scheduler.fireCycleComplete(777);

    expect(player.queue).toEqual([]);
    expect(player.activeSectionId).toBe(3);
    expect(scheduler.startedWith?.bpm).toBe(130);
    expect(scheduler.startedWith?.startAt).toBe(777);
  });

  it('target yang hilang (terhapus) → berhenti aman, tidak menambah antrian', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2]);

    player.trigger(1, def(90, 'TDTD', false, { nextMode: 'target', nextTargetId: 99 }));
    scheduler.fireCycleComplete(100);

    expect(player.activeSectionId).toBeNull();
    expect(scheduler.isPlaying).toBe(false);
    expect(player.queue).toEqual([]);
  });

  it('nextMode=end → berhenti (penutup) walau masih ada section berikutnya', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2]);
    player.registerDefinition(2, def(100));

    player.trigger(1, def(90, 'TDTD', false, { nextMode: 'end' }));
    scheduler.fireCycleComplete(100);

    expect(player.activeSectionId).toBeNull();
    expect(player.queue).toEqual([]);
    expect(scheduler.stopCalls).toBeGreaterThan(0);
  });

  it('berhenti di akhir siklus → stop DITERUSKAN dengan boundaryTime (ketukan terakhir berbunyi penuh)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1]);

    player.trigger(1, def(90, 'TDTD', false, { nextMode: 'end' }));
    scheduler.fireCycleComplete(1234);

    expect(scheduler.stopAt).toBe(1234);
  });

  it('restart setelah stop (antrian masih utuh) → akhir siklus kembali mengikuti antrian', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.enqueue(2, def(110, 'TDTD', false));
    player.stop();

    player.trigger(1, def(90)); // mulai lagi dari idle
    expect(player.activeSectionId).toBe(1);
    scheduler.fireCycleComplete(500);
    expect(player.activeSectionId).toBe(2); // queue-first tetap berlaku
    expect(scheduler.startedWith?.startAt).toBe(500);
  });

  it('idle trigger baris cursor dengan loopCount>1 → sisa loop diinisialisasi (tidak berhenti 1 siklus lebih cepat)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.enqueue(2, def(110, 'TDTD', false));
    player.setLoopCount(0, 2);
    player.trigger(2, def(110, 'TDTD', false)); // idle start langsung ke baris cursor

    scheduler.fireCycleComplete(100);
    expect(player.activeSectionId).toBe(2); // siklus 1 selesai, sisa 1
    scheduler.fireCycleComplete(200);
    expect(player.activeSectionId).toBeNull(); // count habis → fallback berhenti
  });
});

describe('SectionPlayer (fallback dedup — tujuan sudah di antrian)', () => {
  it('nextMode=target yang targetnya SUDAH di antrian → cursor lompat ke kemunculan pertama, TANPA append', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1]);
    player.registerDefinition(1, def(130, 'TDTD', false)); // target — once
    player.registerDefinition(2, def(90, 'TDTD', false, { nextMode: 'target', nextTargetId: 1 }));
    player.registerDefinition(9, def(80)); // starter loop

    player.enqueue(1, def(130, 'TDTD', false)); // antrian [1]
    player.enqueue(2, def(90, 'TDTD', false, { nextMode: 'target', nextTargetId: 1 })); // antrian [1, 2]

    player.trigger(9, def(80));
    scheduler.fireCycleComplete(100); // → baris 0 (section 1)
    scheduler.fireCycleComplete(200); // section 1 sekali → baris 1 (section 2)
    scheduler.fireCycleComplete(300); // section 2 sekali → fallback target 1

    expect(player.activeSectionId).toBe(1); // balik ke section 1
    expect(player.cursor).toBe(0); // ke kemunculan pertama
    expect(player.queue.map((r) => r.sectionId)).toEqual([1, 2]); // TIDAK ada duplikat
    expect(scheduler.startedWith?.startAt).toBe(300);
  });

  it('nextMode=order yang targetnya SUDAH di antrian → cursor lompat, TANPA append', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2, 3]);
    player.registerDefinition(1, def(130, 'TDTD', false));
    player.registerDefinition(2, def(90, 'TDTD', false)); // order → 3
    player.registerDefinition(3, def(120, 'TDTD', false));
    player.registerDefinition(9, def(80));

    player.enqueue(3, def(120, 'TDTD', false)); // antrian [3]
    player.enqueue(1, def(130, 'TDTD', false)); // [3, 1]
    player.enqueue(2, def(90, 'TDTD', false)); // [3, 1, 2]

    player.trigger(9, def(80));
    scheduler.fireCycleComplete(100); // → 3
    scheduler.fireCycleComplete(200); // → 1
    scheduler.fireCycleComplete(300); // → 2
    scheduler.fireCycleComplete(400); // 2 sekali → fallback order → 3

    expect(player.activeSectionId).toBe(3); // balik ke 3 (next dalam urutan)
    expect(player.cursor).toBe(0);
    expect(player.queue.map((r) => r.sectionId)).toEqual([3, 1, 2]);
    expect(scheduler.startedWith?.startAt).toBe(400);
  });

  it('target muncul >1 kali di antrian → lompat ke kemunculan PERTAMA (indeks terendah)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1]);
    player.registerDefinition(1, def(130, 'TDTD', false)); // target
    player.registerDefinition(2, def(90, 'TDTD', false, { nextMode: 'target', nextTargetId: 1 }));
    player.registerDefinition(9, def(80));

    player.enqueue(1, def(130, 'TDTD', false)); // indeks 0
    player.enqueue(1, def(130, 'TDTD', false)); // indeks 1 (duplikat)
    player.enqueue(2, def(90, 'TDTD', false, { nextMode: 'target', nextTargetId: 1 })); // indeks 2

    player.trigger(9, def(80));
    scheduler.fireCycleComplete(100); // → 1 (indeks 0)
    scheduler.fireCycleComplete(200); // → 1 (indeks 1)
    scheduler.fireCycleComplete(300); // → 2 (indeks 2)
    scheduler.fireCycleComplete(400); // 2 sekali → fallback target 1 → ke indeks 0

    expect(player.cursor).toBe(0); // kemunculan pertama, bukan indeks 1
    expect(player.activeSectionId).toBe(1);
    expect(player.queue.map((r) => r.sectionId)).toEqual([1, 1, 2]);
  });
});

describe('SectionPlayer (playFromQueue — tombol Play)', () => {
  it('antrian berisi & cursor valid → mulai dari baris cursor dengan loop count-nya', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.registerDefinition(2, def(110, 'TDTD', false));
    player.registerDefinition(3, def(120, 'TDTD', false));

    player.enqueue(2, def(110, 'TDTD', false)); // baris 0
    player.setLoopCount(0, 2);
    player.enqueue(3, def(120, 'TDTD', false)); // baris 1

    expect(player.playFromQueue()).toBe(true);
    expect(player.activeSectionId).toBe(2);
    expect(player.cursor).toBe(0);
    expect(scheduler.startedWith?.bpm).toBe(110);
    expect(scheduler.startedWith?.startAt).toBeUndefined(); // start biasa, bukan transisi

    scheduler.fireCycleComplete(100); // loop count 2 → sisa 1
    expect(player.activeSectionId).toBe(2);
    scheduler.fireCycleComplete(200); // count habis → baris berikutnya
    expect(player.activeSectionId).toBe(3);
  });

  it('cursor sudah lewat ujung (antrian habis dimainkan) → mulai lagi dari baris PERTAMA', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.registerDefinition(2, def(110, 'TDTD', false));

    player.enqueue(2, def(110, 'TDTD', false));
    player.trigger(2, def(110, 'TDTD', false)); // idle start baris cursor
    scheduler.fireCycleComplete(100); // sekali → cursor -1, fallback stop (playlist kosong)
    expect(player.cursor).toBe(-1);

    expect(player.playFromQueue()).toBe(true);
    expect(player.cursor).toBe(0); // direset ke baris pertama
    expect(player.activeSectionId).toBe(2);
    expect(scheduler.startedWith?.bpm).toBe(110);
  });

  it('antrian kosong → false, tidak mulai apa-apa', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    expect(player.playFromQueue()).toBe(false);
    expect(player.activeSectionId).toBeNull();
    expect(scheduler.startedWith).toBeNull();
  });
});

describe('SectionPlayer (Mode Biasa — pending single-slot pra-antrian)', () => {
  it('trigger section lain saat main (antrian kosong) → pending, TIDAK masuk antrian', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.trigger(2, def(110, 'TDTD', false));
    expect(player.activeSectionId).toBe(1); // masih section 1
    expect(player.pendingSectionId).toBe(2); // pending single-slot
    expect(player.queue).toEqual([]); // tidak masuk antrian
    expect(player.queueMode).toBe(false);
    expect(scheduler.startedWith?.bpm).toBe(90);
  });

  it('akhir siklus dengan pending → pindah TEPAT di batas siklus + BPM baru seketika (hard cut)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(70));
    player.trigger(2, def(110));
    scheduler.fireCycleComplete(123.456);

    expect(player.activeSectionId).toBe(2);
    expect(player.pendingSectionId).toBeNull();
    expect(scheduler.startedWith?.bpm).toBe(110);
    expect(scheduler.startedWith?.startAt).toBe(123.456);
  });

  it('stop → pending dibersihkan', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.trigger(2, def(110));
    player.stop();
    expect(player.activeSectionId).toBeNull();
    expect(player.pendingSectionId).toBeNull();
  });
});

describe('SectionPlayer (transisi mode antrian)', () => {
  it('awal: queueMode=false; enqueue pertama → queueMode=true (pemicu hanya tombol +)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    expect(player.queueMode).toBe(false);
    player.enqueue(2, def(110, 'TDTD', false));
    expect(player.queueMode).toBe(true);
  });

  it('hapus baris satu per satu sampai kosong → queueMode=false lagi (antrian < 1 = nonaktif)', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.enqueue(2, def(110, 'TDTD', false));
    player.enqueue(3, def(120, 'TDTD', false));
    expect(player.queueMode).toBe(true);
    player.removeRow(1);
    expect(player.queueMode).toBe(true);
    player.removeRow(0);
    expect(player.queueMode).toBe(false);
    expect(player.cursor).toBe(-1);
  });

  it('clearQueue → antrian kosong & kembali ke mode biasa', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.enqueue(2, def(110, 'TDTD', false));
    player.enqueue(3, def(120, 'TDTD', false));
    player.clearQueue();
    expect(player.queue).toEqual([]);
    expect(player.cursor).toBe(-1);
    expect(player.queueMode).toBe(false);
  });

  it('enqueue saat ada pending → pending dibuang, mode antrian aktif', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);

    player.trigger(1, def(90));
    player.trigger(2, def(110)); // pending 2 (mode biasa)
    expect(player.pendingSectionId).toBe(2);

    player.enqueue(3, def(120, 'TDTD', false));
    expect(player.queueMode).toBe(true);
    expect(player.pendingSectionId).toBe(3); // pending lama dibuang

    scheduler.fireCycleComplete(100); // queue-first → baris 3, bukan pending 2
    expect(player.activeSectionId).toBe(3);
  });
});

describe('SectionPlayer (Mode Antrian — fallback next_mode auto-append)', () => {
  it('fallback target TIDAK ada di antrian → append & mainkan', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1]);
    player.registerDefinition(1, def(130, 'TDTD', false)); // target — once
    player.registerDefinition(2, def(90, 'TDTD', false, { nextMode: 'target', nextTargetId: 1 }));
    player.registerDefinition(9, def(80)); // starter

    player.enqueue(2, def(90, 'TDTD', false, { nextMode: 'target', nextTargetId: 1 }));
    player.trigger(9, def(80));
    scheduler.fireCycleComplete(100); // → baris 0 (section 2)
    scheduler.fireCycleComplete(200); // 2 sekali → fallback target 1 (belum ada) → append

    expect(player.activeSectionId).toBe(1);
    expect(player.queue.map((r) => r.sectionId)).toEqual([2, 1]);
    expect(scheduler.startedWith?.startAt).toBe(200);
  });

  it('fallback order TIDAK ada di antrian → append & mainkan', () => {
    const scheduler = new FakeScheduler();
    const player = new SectionPlayer(scheduler);
    player.setPlaylist([1, 2, 3]);
    player.registerDefinition(1, def(130, 'TDTD', false)); // order → 2
    player.registerDefinition(2, def(120, 'TDTD', false));
    player.registerDefinition(9, def(80));

    player.enqueue(1, def(130, 'TDTD', false));
    player.trigger(9, def(80));
    scheduler.fireCycleComplete(100); // → 1
    scheduler.fireCycleComplete(200); // 1 sekali → fallback order → 2 → append

    expect(player.activeSectionId).toBe(2);
    expect(player.queue.map((r) => r.sectionId)).toEqual([1, 2]);
  });
});
