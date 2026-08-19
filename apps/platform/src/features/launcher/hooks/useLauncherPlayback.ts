import { useCallback, useEffect, useRef, useState } from 'react';
import { getSamplesIdPlaybackUrl } from '../../../api/endpoints/samples/samples';
import { AudioBufferCache } from '../engine/audio-buffer-cache';
import { Scheduler } from '../engine/scheduler';
import {
  SectionPlayer,
  type NextMode,
  type QueueRow,
  type SectionDefinition,
} from '../engine/section-player';
import { excludeMutedParts, type ScheduledPart } from '../engine/scheduling-math';
import { normalizeStepsToGrid } from '../../../lib/steps';
import { scaleBpm } from '../../../lib/bpm';

export interface LauncherSlot {
  key: string;
  sample_id: number | null;
}

export interface LauncherPart {
  id: number;
  part: string;
  steps: string | null;
  sound_slots: LauncherSlot[];
}

export interface LauncherSection {
  id: number;
  name: string;
  order_index: number;
  bpm_override: number | null;
  /** false = mainkan sekali, lalu lanjut sesuai next_mode. */
  loop: boolean;
  /** 'order' (default) | 'target' (ke next_section_id) | 'end' (berhenti/penutup). */
  next_mode?: string;
  /** Tujuan saat next_mode='target'. */
  next_section_id?: number | null;
  parts: LauncherPart[];
}

/**
 * Orkestrasi playback Launcher Mode: prefetch & decode seluruh sample saat
 * lagu dibuka, clock worker → scheduler lookahead, quantized trigger antar
 * Section, dan Mute per Part (FR-PLAY-10). Engine 100% client-side (TDD AD-6).
 */
export function useLauncherPlayback(songBpm: number) {
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [pendingSectionId, setPendingSectionId] = useState<number | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutedParts, setMutedParts] = useState<Set<string>>(new Set());
  /** Cermin antrian engine — baris persisten, cursor menandai yang sedang/akan main. */
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [cursor, setCursor] = useState(-1);
  /** Playback dibekukan (AudioContext suspend) — Play melanjutkan dari titik yang sama. */
  const [isPaused, setIsPaused] = useState(false);
  /**
   * BPM dasar Song sementara (sesi) — null = ikut BPM asli Song. Mengubahnya
   * menskalakan SEMUA section secara proporsional (termasuk BPM override ★).
   */
  const [tempBpm, setTempBpm] = useState<number | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<SectionPlayer | null>(null);
  const schedulerRef = useRef<Scheduler | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const buffersBySection = useRef<Map<number, ScheduledPart[]>>(new Map());
  const activeSectionRef = useRef<LauncherSection | null>(null);
  const sectionsRef = useRef<LauncherSection[]>([]);
  const mutedRef = useRef<Set<string>>(mutedParts);

  const syncState = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    setActiveSectionId((prev) =>
      player.activeSectionId === prev ? prev : player.activeSectionId,
    );
    setPendingSectionId((prev) =>
      player.pendingSectionId === prev ? prev : player.pendingSectionId,
    );
    // Jaga ref section aktif tetap segar walau playback berpindah lewat
    // auto-advance / Play-antrian (tanpa melalui trigger pad).
    const activeId = player.activeSectionId;
    if (activeId != null && activeSectionRef.current?.id !== activeId) {
      activeSectionRef.current = sectionsRef.current.find((s) => s.id === activeId) ?? null;
    }
    const step = schedulerRef.current?.currentStep ?? 0;
    setStepIndex((prev) => (step === prev ? prev : step));
    const mirrored = player.queue.map((row) => ({ ...row }));
    setQueue((prev) => {
      if (
        prev.length === mirrored.length &&
        prev.every((row, i) => row.sectionId === mirrored[i].sectionId && row.loopCount === mirrored[i].loopCount)
      ) {
        return prev;
      }
      return mirrored;
    });
    setCursor((prev) => (player.cursor === prev ? prev : player.cursor));
  }, []);

  /** Susun ScheduledPart suatu Section dengan menerapkan filter Mute (FR-PLAY-10). */
  const buildParts = useCallback((section: LauncherSection, muted: Set<string>) => {
    const base = buffersBySection.current.get(section.id) ?? [];
    return excludeMutedParts(base, muted);
  }, []);

  /** Normalisasi nilai next_mode dari API menjadi union NextMode engine. */
  const toNextMode = useCallback((mode: string | undefined): NextMode =>
    mode === 'target' || mode === 'end' ? mode : 'order',
  []);

  /** Bangun definisi playback satu section (parts + bpm + perilaku loop). */
  const buildDefinition = useCallback(
    (section: LauncherSection, muted: Set<string>): SectionDefinition => ({
      parts: buildParts(section, muted),
      bpm: scaleBpm(section.bpm_override, songBpm, tempBpm),
      loop: section.loop !== false, // data lama tanpa field loop → diulang
      nextMode: toNextMode(section.next_mode),
      nextTargetId: section.next_section_id ?? undefined,
    }),
    [buildParts, songBpm, tempBpm, toNextMode],
  );

  /** Prefetch + decode seluruh sample yang direferensikan song (FR-PLAY-02). */
  const prepare = useCallback(
    async (sections: LauncherSection[]) => {
      try {
        const AudioCtx = window.AudioContext;
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        const cache = new AudioBufferCache(ctx);

        // Kumpulkan sample id unik → ambil URL playback → decode
        const sampleIds = new Set<number>();
        for (const section of sections) {
          for (const part of section.parts) {
            for (const slot of part.sound_slots) {
              if (slot.sample_id != null) sampleIds.add(slot.sample_id);
            }
          }
        }
        await Promise.all(
          Array.from(sampleIds).map(async (sampleId) => {
            const resp = await getSamplesIdPlaybackUrl(sampleId);
            const url = (resp.data as { data?: { url?: string } })?.data?.url;
            if (url) await cache.load(sampleId, url);
          }),
        );

        // Susun ScheduledPart per section — steps ternormalisasi ke lebar grid
        // minimal agar data lama (pola < 8 langkah) tidak loop terlalu cepat.
        buffersBySection.current = new Map(
          sections.map((section) => {
            const parts: ScheduledPart[] = section.parts.map((part) => {
              const buffers = new Map<string, AudioBuffer>();
              for (const slot of part.sound_slots) {
                if (slot.sample_id != null) {
                  const buffer = cache.get(slot.sample_id);
                  if (buffer) buffers.set(slot.key, buffer);
                }
              }
              return { part: part.part, steps: normalizeStepsToGrid(part.steps ?? ''), buffers };
            });
            return [section.id, parts];
          }),
        );

        const scheduler = new Scheduler(ctx);
        const player = new SectionPlayer(scheduler);
        schedulerRef.current = scheduler;
        playerRef.current = player;

        // Urutan + definisi seluruh section — diperlukan untuk auto-lanjut
        // section "sekali" (loop=false) dan trigger pad.
        sectionsRef.current = sections;
        const ordered = [...sections].sort((a, b) => a.order_index - b.order_index);
        player.setPlaylist(ordered.map((s) => s.id));
        for (const section of ordered) {
          player.registerDefinition(section.id, buildDefinition(section, mutedRef.current));
        }

        const worker = new Worker(new URL('../engine/clock.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onmessage = (event: MessageEvent) => {
          if (event.data?.type === 'tick') {
            scheduler.tick();
            syncState();
          }
        };
        worker.postMessage({ type: 'start' });
        workerRef.current = worker;

        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal menyiapkan playback.');
      }
    },
    [syncState, buildDefinition],
  );

  /**
   * Trigger pad Section. Engine yang memutuskan: idle → mulai langsung;
   * section sama → restart; Mode Antrian → append; Mode Biasa → pending jump.
   */
  const trigger = useCallback(
    (section: LauncherSection) => {
      const player = playerRef.current;
      const ctx = ctxRef.current;
      if (!player || !ctx) return;
      activeSectionRef.current = section;
      const definition = buildDefinition(section, mutedRef.current);
      player.registerDefinition(section.id, definition);
      void ctx.resume(); // AudioContext boleh dibuat suspended — resume pada gesture
      setIsPaused(false);
      player.trigger(section.id, definition);
      syncState();
    },
    [buildDefinition, syncState],
  );

  /** Tombol antrian pad (append-only): tambahkan section ke akhir antrian. */
  const enqueue = useCallback(
    (section: LauncherSection) => {
      const player = playerRef.current;
      if (!player) return;
      const definition = buildDefinition(section, mutedRef.current);
      player.registerDefinition(section.id, definition);
      player.enqueue(section.id, definition);
      syncState();
    },
    [buildDefinition, syncState],
  );

  /** Hapus semua baris antrian → kembali ke Mode Biasa (antrian < 1 = nonaktif). */
  const clearQueue = useCallback(() => {
    playerRef.current?.clearQueue();
    syncState();
  }, [syncState]);

  /** Ubah jumlah loop satu baris antrian. */
  const setLoopCount = useCallback(
    (index: number, loopCount: number) => {
      playerRef.current?.setLoopCount(index, loopCount);
      syncState();
    },
    [syncState],
  );

  /** Hapus satu baris antrian. */
  const removeRow = useCallback(
    (index: number) => {
      playerRef.current?.removeRow(index);
      syncState();
    },
    [syncState],
  );

  /** Pindahkan baris antrian (drag-drop / tombol ↑↓). */
  const moveRow = useCallback(
    (from: number, to: number) => {
      playerRef.current?.moveRow(from, to);
      syncState();
    },
    [syncState],
  );

  /**
   * Tombol Play: lanjutkan bila pause; mulai per antrian bila idle (cursor →
   * baris cursor, cursor lewat ujung → baris pertama); antrian kosong → section
   * urutan pertama. No-op bila sedang main.
   */
  const play = useCallback(() => {
    const player = playerRef.current;
    const ctx = ctxRef.current;
    if (!player || !ctx) return;
    if (isPaused) {
      // Pause → lanjutkan tepat dari titik beku (jadwal step & bunyi utuh).
      void ctx.resume();
      setIsPaused(false);
      return;
    }
    if (player.activeSectionId != null) return; // sudah main — no-op
    void ctx.resume();
    if (player.playFromQueue()) {
      syncState();
      return;
    }
    if (player.queue.length > 0) return; // antrian berisi tapi barisnya tak tersedia — aman
    // Antrian kosong → mulai dari section urutan pertama.
    const ordered = [...sectionsRef.current].sort((a, b) => a.order_index - b.order_index);
    const first = ordered[0];
    if (!first) return;
    activeSectionRef.current = first;
    const definition = buildDefinition(first, mutedRef.current);
    player.registerDefinition(first.id, definition);
    player.trigger(first.id, definition);
    syncState();
  }, [buildDefinition, isPaused, syncState]);

  /** Tombol Pause: bekukan AudioContext — jadwal step & bunyi berhenti di titik yang sama. */
  const pause = useCallback(() => {
    const player = playerRef.current;
    const ctx = ctxRef.current;
    if (!player || !ctx || player.activeSectionId == null || isPaused) return;
    void ctx.suspend();
    setIsPaused(true);
  }, [isPaused]);

  /** Tombol Stop: hentikan playback; antrian tetap utuh; context di-resume bila pause. */
  const stop = useCallback(() => {
    playerRef.current?.stop();
    activeSectionRef.current = null;
    void ctxRef.current?.resume();
    setIsPaused(false);
    syncState();
  }, [syncState]);

  /** Mute/unmute satu Part; definisi semua section diperbarui & section aktif diterapkan ulang. */
  const toggleMute = useCallback(
    (partKey: string) => {
      const next = new Set(mutedRef.current);
      if (next.has(partKey)) next.delete(partKey);
      else next.add(partKey);
      mutedRef.current = next;
      setMutedParts(next);

      const player = playerRef.current;
      if (player) {
        // Perbarui definisi semua section dengan filter mute terbaru.
        for (const section of sectionsRef.current) {
          player.registerDefinition(section.id, buildDefinition(section, next));
        }
        const active = activeSectionRef.current;
        if (active && player.activeSectionId === active.id) {
          player.trigger(active.id, buildDefinition(active, next));
        }
      }
      syncState();
    },
    [buildDefinition, syncState],
  );

  // Bersihkan worker & context saat unmount.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  /**
   * Atur BPM temporary (null = reset ke BPM asli Song). Berlaku realtime:
   * definisi semua section didaftar ulang dengan rasio baru, dan section yang
   * sedang main langsung pindah tempo via scheduler.setBpm.
   */
  const applyTempBpm = useCallback(
    (next: number | null) => {
      setTempBpm(next);
      const player = playerRef.current;
      if (!player) return;
      const ratio = next != null && songBpm > 0 ? next / songBpm : 1;
      for (const section of sectionsRef.current) {
        const definition = buildDefinition(section, mutedRef.current);
        definition.bpm = (section.bpm_override ?? songBpm) * ratio;
        player.registerDefinition(section.id, definition);
      }
      // Jangan andalkan activeSectionRef (basi saat auto-advance) — cari section
      // aktif langsung dari id yang tercatat di engine.
      const activeId = player.activeSectionId;
      const active = activeId != null
        ? sectionsRef.current.find((s) => s.id === activeId)
        : undefined;
      if (active) {
        schedulerRef.current?.setBpm((active.bpm_override ?? songBpm) * ratio);
      }
      syncState();
    },
    [buildDefinition, songBpm, syncState],
  );

  const isPlaying = activeSectionId != null;
  /** Mode Antrian aktif bila antrian tidak kosong (baris < 1 = Mode Biasa). */
  const queueMode = queue.length > 0;

  return {
    activeSectionId,
    pendingSectionId,
    stepIndex,
    isPlaying,
    isPaused,
    ready,
    error,
    mutedParts,
    queue,
    cursor,
    queueMode,
    tempBpm,
    prepare,
    trigger,
    play,
    pause,
    enqueue,
    clearQueue,
    setLoopCount,
    removeRow,
    moveRow,
    stop,
    toggleMute,
    setTempBpm: applyTempBpm,
  };
}
