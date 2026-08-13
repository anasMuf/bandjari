import { useCallback, useEffect, useRef, useState } from 'react';
import { getSamplesIdPlaybackUrl } from '../../../api/endpoints/samples/samples';
import { keyAt, stepCount } from '../../../lib/steps';

export interface SectionPreviewPart {
  id: number;
  steps: string;
  slots: Array<{ key: string; sample_id: number | null }>;
}

interface PlaybackUrlData {
  data?: { url?: string };
}

/**
 * Preview audio seluruh Section sekaligus (semua Part) — dipakai tombol
 * "Play Preview" / "Preview Section Ini" di Sequencer (FR-SEQ-05).
 *
 * - Real-time: menerima GETTER data part (bukan snapshot) — dipanggil ulang
 *   tiap tick, sehingga edit kotak saat preview berjalan langsung terdengar.
 * - Multi-bunyi sekolom: satu langkah bisa memicu beberapa bunyi part yang sama.
 * - Choke per Part: bunyi baru memotong bunyi lama part yang sama (monofonik
 *   per instrumen), ekor sample tidak menumpuk.
 * - Tiap part loop sesuai panjang steps-nya (AC-2); step tanpa sample senyap
 *   (AC-5). 1 step = 1/16 ketukan (60000/bpm/4 ms).
 */
export function useSectionPreview() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setIsPlaying(false);
    setStepIndex(0);
  }, []);

  const play = useCallback(
    async (getParts: () => SectionPreviewPart[], bpm: number) => {
      stop();

      const AudioCtx = window.AudioContext;
      const ctx = new AudioCtx();

      try {
        // Decode sample dari snapshot awal — penambahan slot baru saat preview
        // berjalan baru terdengar setelah play diulang.
        const buffers = new Map<number, AudioBuffer>();
        const sampleIds = new Set<number>();
        for (const part of getParts()) {
          for (const slot of part.slots) {
            if (slot.sample_id != null) sampleIds.add(slot.sample_id);
          }
        }
        await Promise.all(
          Array.from(sampleIds).map(async (sampleId) => {
            const resp = await getSamplesIdPlaybackUrl(sampleId);
            const url = (resp.data as PlaybackUrlData)?.data?.url;
            if (!url) return;
            const arrayBuffer = await fetch(url).then((r) => r.arrayBuffer());
            const buffer = await ctx.decodeAudioData(arrayBuffer);
            buffers.set(sampleId, buffer);
          }),
        );

        // Sumber aktif per Part — untuk choke monofonik.
        const activeSources = new Map<string, AudioBufferSourceNode[]>();

        const chokePart = (partKey: string) => {
          const previous = activeSources.get(partKey);
          if (previous) {
            for (const source of previous) {
              try {
                source.stop();
              } catch {
                // sudah berhenti — abaikan
              }
            }
          }
          activeSources.set(partKey, []);
        };

        let step = 0;
        let timer: ReturnType<typeof setTimeout>;
        // 1 step = 1/16 ketukan (grid sequencer standar): 60000/bpm/4 ms.
        const stepMs = 60000 / bpm / 4;

        const tick = () => {
          const parts = getParts().filter((p) => stepCount(p.steps) > 0);
          const totalLen = parts.reduce((max, p) => Math.max(max, stepCount(p.steps)), 0);

          for (const part of parts) {
            const keys = keyAt(part.steps, step);
            if (!keys || keys.length === 0) continue;
            const sampleByKey = new Map(part.slots.map((slot) => [slot.key, slot.sample_id]));
            const srcKey = `part-${part.id}`;
            let started = false;
            for (const key of keys) {
              const sampleId = sampleByKey.get(key);
              if (sampleId == null) continue; // senyap (AC-5)
              const buffer = buffers.get(sampleId);
              if (!buffer) continue;
              if (!started) {
                chokePart(srcKey); // bunyi baru part ini memotong bunyi lamanya
                started = true;
              }
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start();
              const sources = activeSources.get(srcKey) ?? [];
              sources.push(source);
              activeSources.set(srcKey, sources);
            }
          }

          setStepIndex(totalLen > 0 ? step % totalLen : 0);
          step++;
          timer = setTimeout(tick, stepMs);
        };

        tick();
        setIsPlaying(true);
        stopRef.current = () => {
          clearTimeout(timer);
          for (const sources of activeSources.values()) {
            for (const source of sources) {
              try {
                source.stop();
              } catch {
                // sudah berhenti — abaikan
              }
            }
          }
          ctx.close();
          setIsPlaying(false);
          setStepIndex(0);
        };
      } catch (error) {
        ctx.close();
        throw error;
      }
    },
    [stop],
  );

  // Hentikan playback saat komponen unmount.
  useEffect(() => stop, [stop]);

  return { play, stop, isPlaying, stepIndex };
}
