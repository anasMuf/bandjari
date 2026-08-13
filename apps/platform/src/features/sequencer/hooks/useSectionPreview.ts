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
 * "Play Preview" / "Preview Section Ini" di Sequencer (FR-SEQ-05). Setiap part
 * loop mengikuti panjang steps-nya sendiri (AC-2); step tanpa sample senyap
 * (AC-5). Playhead (indeks step global) diumpankan balik untuk highlight grid.
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
    async (parts: SectionPreviewPart[], bpm: number) => {
      stop();

      const AudioCtx = window.AudioContext;
      const ctx = new AudioCtx();

      try {
        const buffers = new Map<number, AudioBuffer>();
        const sampleIds = new Set<number>();
        for (const part of parts) {
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

        const prepared = parts
          .filter((p) => stepCount(p.steps) > 0)
          .map((part) => ({
            id: part.id,
            steps: part.steps,
            keys: new Map(part.slots.map((slot) => [slot.key, slot.sample_id])),
          }));
        const totalLen = prepared.reduce((max, p) => Math.max(max, stepCount(p.steps)), 0);
        if (totalLen === 0) {
          ctx.close();
          return;
        }

        // Choke monofonik per Part: bunyi baru memotong bunyi sebelumnya dari
        // part yang sama — ekor sample panjang tidak menumpuk antar step.
        const activeSources = new Map<string, AudioBufferSourceNode>();

        let step = 0;
        let timer: ReturnType<typeof setTimeout>;
        // 1 step = 1/16 ketukan (grid sequencer standar): 60000/bpm/4 ms.
        const stepMs = 60000 / bpm / 4;

        const tick = () => {
          for (const part of prepared) {
            const key = keyAt(part.steps, step);
            if (!key) continue;
            const sampleId = part.keys.get(key);
            if (sampleId == null) continue; // senyap (AC-5)
            const buffer = buffers.get(sampleId);
            if (!buffer) continue;
            const srcKey = `part-${part.id}`;
            const previous = activeSources.get(srcKey);
            if (previous) {
              try {
                previous.stop();
              } catch {
                // sudah berhenti — abaikan
              }
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start();
            activeSources.set(srcKey, source);
          }
          setStepIndex(step % totalLen);
          step++;
          timer = setTimeout(tick, stepMs);
        };

        tick();
        setIsPlaying(true);
        stopRef.current = () => {
          clearTimeout(timer);
          for (const source of activeSources.values()) {
            try {
              source.stop();
            } catch {
              // sudah berhenti — abaikan
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
