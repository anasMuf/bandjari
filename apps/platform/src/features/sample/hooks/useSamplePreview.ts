import { useCallback, useEffect, useRef, useState } from 'react';
import { getSamplesIdPlaybackUrl } from '../../../api/endpoints/samples/samples';

interface PlaybackUrlData {
  data?: { url?: string };
}

/**
 * Preview satu sample (tombol ▶ per baris di Sequencer Grid & Library Sample).
 *
 * Hanya satu preview aktif dalam satu waktu per pemakaian hook: memulai preview
 * baru membatalkan load & bunyi yang sedang berjalan (AbortController + pause
 * elemen Audio), sehingga rapid-click tidak menumpuk suara ataupun request.
 * `previewingId` dipakai tombol menampilkan placeholder "Memuat…" selama sample
 * disiapkan (fetch URL playback + mulai streaming).
 */
export function useSamplePreview() {
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    setPreviewingId(null);
  }, []);

  const preview = useCallback(
    async (sampleId: number) => {
      // Preview baru menggantikan yang lama — tidak pernah dua bunyi sekaligus.
      stop();

      setPreviewingId(sampleId);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const resp = await getSamplesIdPlaybackUrl(sampleId, { signal: controller.signal });
        const url = (resp.data as PlaybackUrlData)?.data?.url;
        if (!url) return;
        const audio = new Audio(url);
        audioRef.current = audio;
        await audio.play();
      } catch (error) {
        // Dibatalkan oleh preview/stop berikutnya — bukan error untuk pengguna.
        if (controller.signal.aborted) return;
        throw error;
      } finally {
        if (!controller.signal.aborted) {
          abortRef.current = null;
          // Placeholder hilang begitu bunyi mulai — suara tetap berjalan.
          setPreviewingId(null);
        }
      }
    },
    [stop],
  );

  // Hentikan preview & batalkan load in-flight saat komponen unmount.
  useEffect(() => stop, [stop]);

  return { previewingId, preview };
}
