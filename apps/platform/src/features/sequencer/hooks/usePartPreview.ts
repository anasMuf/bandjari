import { useCallback, useEffect, useRef, useState } from 'react';
import { getSamplesIdPlaybackUrl } from '../../../api/endpoints/samples/samples';

export interface PreviewSlot {
  key: string;
  sample_id: number | null;
}

interface PlaybackUrlData {
  data?: { url?: string };
}

/**
 * Preview satu SectionPart: ambil signed URL tiap slot → decode AudioBuffer →
 * loop steps mengikuti BPM. Step yang slot-nya tanpa sample senyap (AC-5).
 * Ini subset engine playback (scheduling setTimeout sederhana) — engine
 * produksi dengan Web Worker + lookahead menyusul di Phase 7 (E7-1).
 */
export function usePartPreview() {
  const [isPlaying, setIsPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setIsPlaying(false);
  }, []);

  const play = useCallback(async (slots: PreviewSlot[], steps: string, bpm: number) => {
    stop();

    const AudioCtx = window.AudioContext;
    const ctx = new AudioCtx();

    try {
      const buffers = new Map<string, AudioBuffer>();
      for (const slot of slots) {
        if (slot.sample_id == null) continue;
        const resp = await getSamplesIdPlaybackUrl(slot.sample_id);
        const url = (resp.data as PlaybackUrlData)?.data?.url;
        if (!url) continue;
        const arrayBuffer = await fetch(url).then((r) => r.arrayBuffer());
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        buffers.set(slot.key, buffer);
      }

      if (!steps) {
        ctx.close();
        return;
      }

      let step = 0;
      let timer: ReturnType<typeof setTimeout>;
      const stepMs = 60000 / bpm;

      const tick = () => {
        const key = steps[step % steps.length];
        const buffer = buffers.get(key);
        if (buffer) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start();
        }
        step++;
        timer = setTimeout(tick, stepMs);
      };

      tick();
      setIsPlaying(true);
      stopRef.current = () => {
        clearTimeout(timer);
        ctx.close();
        setIsPlaying(false);
      };
    } catch (error) {
      ctx.close();
      throw error;
    }
  }, [stop]);

  // Hentikan playback saat komponen unmount.
  useEffect(() => stop, [stop]);

  return { play, stop, isPlaying };
}
