import { useCallback, useEffect, useRef, useState } from 'react';
import { getSamplesIdPlaybackUrl } from '../../../api/endpoints/samples/samples';
import { AudioBufferCache } from '../engine/audio-buffer-cache';
import { Scheduler } from '../engine/scheduler';
import { SectionPlayer } from '../engine/section-player';
import type { ScheduledPart } from '../engine/scheduling-math';

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
  parts: LauncherPart[];
}

/**
 * Orkestrasi playback Launcher Mode: prefetch & decode seluruh sample saat
 * lagu dibuka, clock worker → scheduler lookahead, dan quantized trigger antar
 * Section. Engine 100% client-side (TDD AD-6, Bagian 9).
 */
export function useLauncherPlayback(songBpm: number) {
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [pendingSectionId, setPendingSectionId] = useState<number | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<SectionPlayer | null>(null);
  const schedulerRef = useRef<Scheduler | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const buffersBySection = useRef<Map<number, ScheduledPart[]>>(new Map());

  const syncState = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    setActiveSectionId((prev) =>
      player.activeSectionId === prev ? prev : player.activeSectionId,
    );
    setPendingSectionId((prev) =>
      player.pendingSectionId === prev ? prev : player.pendingSectionId,
    );
    const step = schedulerRef.current?.currentStep ?? 0;
    setStepIndex((prev) => (step === prev ? prev : step));
  }, []);

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

        // Susun ScheduledPart per section
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
              return { steps: part.steps ?? '', buffers };
            });
            return [section.id, parts];
          }),
        );

        const scheduler = new Scheduler(ctx);
        const player = new SectionPlayer(scheduler);
        schedulerRef.current = scheduler;
        playerRef.current = player;

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
    [syncState],
  );

  /** Trigger pad Section (quantized bila section lain sedang aktif). */
  const trigger = useCallback(
    (section: LauncherSection) => {
      const player = playerRef.current;
      const ctx = ctxRef.current;
      if (!player || !ctx) return;
      const parts = buffersBySection.current.get(section.id) ?? [];
      const bpm = section.bpm_override ?? songBpm;
      void ctx.resume(); // AudioContext boleh dibuat suspended — resume pada gesture
      player.trigger(section.id, { parts, bpm });
      syncState();
    },
    [songBpm, syncState],
  );

  const stop = useCallback(() => {
    playerRef.current?.stop();
    syncState();
  }, [syncState]);

  // Bersihkan worker & context saat unmount.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  const isPlaying = activeSectionId != null;

  return { activeSectionId, pendingSectionId, stepIndex, isPlaying, ready, error, prepare, trigger, stop };
}
