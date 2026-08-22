import { useCallback, useEffect, useRef, useState } from 'react';
import { getSamplesIdPlaybackUrl } from '../../../api/endpoints/samples/samples';
import { keyAt, MIN_GRID_COLUMNS, normalizeStepsToGrid, stepCount } from '../../../lib/steps';

export interface SectionPreviewPart {
  id: number;
  steps: string;
  slots: Array<{ key: string; sample_id: number | null }>;
  /** Part yang di-mute tidak dibunyikan; bunyi yang sedang berdering dipotong. */
  muted?: boolean;
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
 *
 * Guard anti-tumpuk: pemuatan sample bergantung koneksi, jadi play() memberi
 * tahu pemanggil lewat `isPreparing` (dipakai tombol menampilkan placeholder
 * "Memuat audio…"). Tiap play()/stop() membatalkan load & request HTTP yang
 * masih berjalan (AbortController + token generasi), sehingga play() yang
 * tertunda tidak pernah mulai berbunyi — klik berulang di tengah load tidak
 * menumpuk suara.
 */
export function useSectionPreview() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);
  /**
   * Token generasi playback — dinaikkan tiap stop() / play() baru. play() yang
   * masih memuat sample dianggap basi bila nomornya berubah; hasil load-nya
   * dibuang tanpa memulai bunyi.
   */
  const generationRef = useRef(0);
  /** AbortController aktif — membatalkan request sample yang sedang berjalan. */
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    // Batalkan load in-flight + tandai play() yang tertunda sebagai basi.
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    stopRef.current?.();
    stopRef.current = null;
    setIsPreparing(false);
    setIsPlaying(false);
    setStepIndex(0);
  }, []);

  const play = useCallback(
    async (getParts: () => SectionPreviewPart[], bpm: number) => {
      stop();

      const generation = generationRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setIsPreparing(true);

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
            const resp = await getSamplesIdPlaybackUrl(sampleId, { signal: controller.signal });
            const url = (resp.data as PlaybackUrlData)?.data?.url;
            if (!url) return;
            const arrayBuffer = await fetch(url, { signal: controller.signal }).then((r) => r.arrayBuffer());
            const buffer = await ctx.decodeAudioData(arrayBuffer);
            buffers.set(sampleId, buffer);
          }),
        );

        // play() ini dibatalkan selama load (stop / tombol ditekan ulang) —
        // buang hasilnya tanpa mulai tick agar bunyi tidak bertumpuk. State
        // isPreparing tidak disentuh di sini: stop()/play() pengganti sudah
        // menetapkan nilainya.
        if (generation !== generationRef.current) {
          void ctx.close();
          return;
        }
        abortRef.current = null;

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
          // Normalisasi ke lebar grid minimal agar siklus mengikuti jumlah kolom
          // yang tampil (bukan jumlah kotak terisi) — 1 kotak = 1 pukulan per
          // siklus 8 langkah, bukan bunyi diulang tiap langkah.
          const parts = getParts().map((p) => ({ ...p, steps: normalizeStepsToGrid(p.steps) }));
          // Siklus tetap dihitung dari SEMUA part (termasuk yang di-mute) agar
          // playhead tidak melompat saat mute di-toggle.
          const contentLen = parts.reduce((max, p) => Math.max(max, stepCount(p.steps)), 0);
          // Bila belum ada isi sama sekali, indikator playhead tetap berjalan
          // menyusuri lebar grid (metronom visual).
          const cycleLen = contentLen > 0 ? contentLen : MIN_GRID_COLUMNS;

          for (const part of parts) {
            const srcKey = `part-${part.id}`;
            if (part.muted) {
              // Mute terasa seketika (tanpa stop): potong bunyi yang sedang
              // berdering dari part ini.
              chokePart(srcKey);
              continue;
            }
            const keys = keyAt(part.steps, step);
            if (!keys || keys.length === 0) continue;
            const sampleByKey = new Map(part.slots.map((slot) => [slot.key, slot.sample_id]));
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

          setStepIndex(step % cycleLen);
          step++;
          timer = setTimeout(tick, stepMs);
        };

        tick();
        setIsPlaying(true);
        setIsPreparing(false);
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
          setIsPreparing(false);
          setStepIndex(0);
        };
      } catch (error) {
        void ctx.close();
        // Load dibatalkan karena play() digantikan / stop — bukan error, jangan
        // diteruskan ke pemanggil (state sudah diatur stop()/play() pengganti).
        if (generation === generationRef.current) {
          setIsPreparing(false);
          throw error;
        }
      }
    },
    [stop],
  );

  // Hentikan playback & load in-flight saat komponen unmount.
  useEffect(() => stop, [stop]);

  return { play, stop, isPlaying, isPreparing, stepIndex };
}
