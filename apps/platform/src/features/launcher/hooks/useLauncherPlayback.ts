import { useCallback, useEffect, useRef, useState } from 'react';
import { getSamplesIdPlaybackUrl } from '../../../api/endpoints/samples/samples';
import { AudioBufferCache } from '../engine/audio-buffer-cache';
import { Scheduler } from '../engine/scheduler';
import { SectionPlayer, type NextMode, type SectionDefinition } from '../engine/section-player';
import { excludeMutedParts, type ScheduledPart } from '../engine/scheduling-math';
import { normalizeStepsToGrid } from '../../../lib/steps';

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
    const step = schedulerRef.current?.currentStep ?? 0;
    setStepIndex((prev) => (step === prev ? prev : step));
  }, []);

  /** Susun ScheduledPart suatu Section dengan menerapkan filter Mute (FR-PLAY-10). */
  const buildParts = useCallback((section: LauncherSection, muted: Set<string>) => {
    const base = buffersBySection.current.get(section.id) ?? [];
    return excludeMutedParts(base, muted);
  }, []);

  /** Normalisasi nilai next_mode dari API menjadi union NextMode engine. */
  const toNextMode = (mode: string | undefined): NextMode =>
    mode === 'target' || mode === 'end' ? mode : 'order';

  /** Bangun definisi playback satu section (parts + bpm + perilaku loop). */
  const buildDefinition = useCallback(
    (section: LauncherSection, muted: Set<string>): SectionDefinition => ({
      parts: buildParts(section, muted),
      bpm: section.bpm_override ?? songBpm,
      loop: section.loop !== false, // data lama tanpa field loop → diulang
      nextMode: toNextMode(section.next_mode),
      nextTargetId: section.next_section_id ?? undefined,
    }),
    [buildParts, songBpm],
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

  /** Trigger pad Section (quantized bila section lain sedang aktif — FR-PLAY-04). */
  const trigger = useCallback(
    (section: LauncherSection) => {
      const player = playerRef.current;
      const ctx = ctxRef.current;
      if (!player || !ctx) return;
      activeSectionRef.current = section;
      player.registerDefinition(section.id, buildDefinition(section, mutedRef.current));
      const definition = buildDefinition(section, mutedRef.current);
      void ctx.resume(); // AudioContext boleh dibuat suspended — resume pada gesture
      player.trigger(section.id, definition);
      syncState();
    },
    [buildDefinition, syncState],
  );

  const stop = useCallback(() => {
    playerRef.current?.stop();
    activeSectionRef.current = null;
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

  const isPlaying = activeSectionId != null;

  return {
    activeSectionId,
    pendingSectionId,
    stepIndex,
    isPlaying,
    ready,
    error,
    mutedParts,
    prepare,
    trigger,
    stop,
    toggleMute,
  };
}
