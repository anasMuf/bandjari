import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useGetSongsId } from '../../../api/endpoints/songs/songs';
import { useGetSectionsIdParts, usePutSectionPartsId } from '../../../api/endpoints/section-parts/section-parts';
import type { DtoSuccessResponse } from '../../../api/model';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';
import { useAuth } from '../../auth/AuthContext';
import { LoginPromptInline } from '../../auth/components/LoginPromptInline';
import { SequencerGrid, previewSampleAudio, type GridSlot } from './SequencerGrid';
import { SoundSlotManager, type SoundSlotData } from './SoundSlotManager';
import { useSectionPreview } from '../hooks/useSectionPreview';
import { padSteps, trimSteps, decodeSteps, encodeSteps, setStepExtending, toggleKeyInCell, stepCount, normalizeStepsToGrid, roundUpToStepMultiple } from '../../../lib/steps';
import { PART_LABELS, PART_ORDER } from '../utils/parts';

interface PartData {
  id: number;
  section_id: number;
  part: string;
  steps: string | null;
  sound_slots: Array<SoundSlotData & { sample?: { id: number; name: string; is_system_template: boolean } | null }>;
}

interface SequencerViewProps {
  songId: number;
  sectionId: number;
  sectionName: string;
  /** BPM dasar Song (untuk preview & tampilan info). */
  songBpm: number;
  /** BPM override Section bila ada — dipakai sebagai tempo efektif (AC-9). */
  bpmOverride: number | null;
}

/** Jumlah langkah yang ditambah/dikurangi lewat kontrol ±8 step (FR-SEQ-03). */
const STEP_BATCH = 4;

export function SequencerView({ songId, sectionId, sectionName, songBpm, bpmOverride }: SequencerViewProps) {
  const { addToast } = useToast();
  const { isAuthenticated, isAdmin } = useAuth();
  const partsQuery = useGetSectionsIdParts(sectionId);
  const songQuery = useGetSongsId(songId);
  const saveStepsMutation = usePutSectionPartsId();
  const preview = useSectionPreview();

  const [stepsByPart, setStepsByPart] = useState<Record<number, string>>({});
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [editPromptZone, setEditPromptZone] = useState<'slots' | 'grid' | null>(null);
  const [focusCreateSignal, setFocusCreateSignal] = useState(0);
  // Mute per Part (hanya memengaruhi preview Sequencer) — real-time via ref.
  const [mutedParts, setMutedParts] = useState<Set<string>>(new Set());
  const mutedPartsRef = useRef(mutedParts);
  mutedPartsRef.current = mutedParts;
  const managerRef = useRef<HTMLDivElement>(null);
  // Refs agar preview membaca isian grid & slot TERKINI setiap tick (real-time),
  // bukan snapshot saat tombol Play ditekan.
  const stepsByPartRef = useRef(stepsByPart);
  stepsByPartRef.current = stepsByPart;

  // Normalisasi defensif: sound_slots mungkin null dari respons lama — pastikan array.
  const parts = (((partsQuery.data?.data as DtoSuccessResponse | undefined)?.data ?? []) as PartData[]).map(
    (part) => ({ ...part, sound_slots: part.sound_slots ?? [] }),
  );
  const orderedParts = useMemo(
    () =>
      PART_ORDER.map((p) => parts.find((part) => part.part === p)).filter(
        (part): part is PartData => Boolean(part),
      ),
    [parts],
  );
  const selectedPart = orderedParts.find((p) => p.id === selectedPartId) ?? orderedParts[0];

  // State edit per Part — komponen di-remount per section (key=sectionId di route),
  // sehingga stepsByPart selalu mulai kosong lalu jatuh ke nilai dari server.
  const stepsOf = (part: PartData) => stepsByPart[part.id] ?? part.steps ?? '';

  useEffect(() => {
    if (!selectedPartId && orderedParts.length > 0) {
      setSelectedPartId(orderedParts[0].id);
    }
  }, [orderedParts, selectedPartId]);

  if (partsQuery.isLoading || songQuery.isLoading) {
    return <p className="text-sm text-stone-500">Memuat sequencer...</p>;
  }

  if (partsQuery.isError) {
    return (
      <div aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-800">
          Section tidak ditemukan atau tidak dapat diakses.
        </p>
        {!isAuthenticated && (
          <>
            <p className="mt-1 text-xs text-red-700">
              Section lagu pribadi hanya bisa diakses pemiliknya — masuk untuk membuka lagu Anda.
            </p>
            <Link
              to="/login"
              className="mt-3 inline-flex items-center justify-center rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Masuk
            </Link>
          </>
        )}
      </div>
    );
  }

  if (!selectedPart || orderedParts.length === 0) {
    return (
      <p aria-live="polite" className="text-sm text-stone-500">
        Section ini belum memiliki bagian instrumen.
      </p>
    );
  }

  const songResp = songQuery.data?.data;
  const songData =
    songResp && 'data' in songResp ? (songResp.data as { bpm?: number; is_system_template?: boolean }) : undefined;
  // Tempo efektif = BPM override Section (AC-9) atau BPM dasar Song.
  const effectiveBpm = bpmOverride ?? songBpm;
  const isTemplate = songData?.is_system_template === true;
  // Song Template System read-only bagi non-admin (FR-SONG-08); Guest read-only
  // semua (FR-AUTH-06); admin boleh mengedit template (FR-ROLE).
  const readOnly = !isAuthenticated || (isTemplate && !isAdmin);

  const dirtyParts = orderedParts.filter((part) => stepsOf(part) !== (part.steps ?? ''));
  const allPartsEmpty = orderedParts.every((part) => part.sound_slots.length === 0);

  const handleToggleCell = (partId: number, slotKey: string, colIndex: number) => {
    const part = orderedParts.find((p) => p.id === partId);
    if (!part) return;
    const current = stepsOf(part);
    const cells = decodeSteps(current);
    if (colIndex < cells.length) {
      // Toggle kotak itu SAJA — key baris lain yang aktif di kolom yang sama
      // tidak terganggu (multi-bunyi sekolom, "T+D").
      setStepsByPart((prev) => ({
        ...prev,
        [partId]: encodeSteps(toggleKeyInCell(cells, colIndex, slotKey)),
      }));
    } else {
      // Nyalakan kotak itu saja — celah di kirinya jadi istirahat.
      setStepsByPart((prev) => ({ ...prev, [partId]: setStepExtending(current, colIndex, slotKey) }));
    }
  };

  const handleBatchSteps = (delta: number) => {
    if (readOnly) {
      setEditPromptZone('grid');
      return;
    }
    // Tanpa jenis bunyi (SoundSlot) tidak ada key untuk mengisi langkah.
    const withSlots = orderedParts.filter((part) => part.sound_slots.length > 0);
    if (withSlots.length === 0) {
      addToast({
        variant: 'info',
        title: 'Tambahkan jenis bunyi dulu',
        message: 'Buat SoundSlot lewat “+ Tambah Bunyi” sebelum mengatur panjang langkah.',
      });
      return;
    }
    setStepsByPart((prev) => {
      const next = { ...prev };
      for (const part of withSlots) {
        const current = stepsOf(part);
        next[part.id] = delta > 0 ? padSteps(current, delta) : trimSteps(current, -delta);
      }
      return next;
    });
  };

  /** Bersihkan seluruh kotak step satu Part (termasuk bass) — edit lokal sampai Simpan. */
  const handleClearPart = (partId: number) => {
    if (readOnly) {
      setEditPromptZone('grid');
      return;
    }
    const part = orderedParts.find((p) => p.id === partId);
    setStepsByPart((prev) => ({ ...prev, [partId]: '' }));
    addToast({
      variant: 'info',
      title: 'Pola dibersihkan',
      message: `Semua kotak step ${part ? PART_LABELS[part.part] ?? part.part : ''} dikosongkan — klik “Simpan Perubahan” untuk menyimpan.`,
    });
  };

  const handleSave = () => {
    if (dirtyParts.length === 0) return;
    Promise.all(
      dirtyParts.map((part) => {
        // Simpan dalam bentuk ternormalisasi: pola pendek digenapi ke lebar
        // grid (8 kolom) dengan istirahat agar siklus playback di Launcher
        // mengikuti lebar grid, bukan jumlah kotak terisi.
        const value = normalizeStepsToGrid(stepsOf(part));
        return saveStepsMutation.mutateAsync({
          id: part.id,
          data: { steps: { set: true, value } },
        });
      }),
    )
      .then(() => {
        addToast({ variant: 'success', title: 'Steps tersimpan', message: 'Pola pukulan diperbarui.' });
        partsQuery.refetch();
      })
      .catch((error: unknown) => {
        addToast({
          variant: 'error',
          title: 'Gagal menyimpan steps',
          message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
        });
      });
  };

  const handleTogglePreview = () => {
    if (preview.isPlaying) {
      preview.stop();
      return;
    }
    // Getter dipanggil ulang tiap tick → edit kotak & mute part saat preview
    // berjalan langsung terdengar (real-time). Part yang di-mute tetap ikut
    // dikirim (dengan flag) agar bunyi berderingnya langsung dipotong.
    preview
      .play(
        () =>
          orderedParts.map((part) => ({
            id: part.id,
            steps: stepsByPartRef.current[part.id] ?? part.steps ?? '',
            slots: part.sound_slots.map((slot) => ({ key: slot.key, sample_id: slot.sample_id })),
            muted: mutedPartsRef.current.has(part.part),
          })),
        effectiveBpm,
      )
      .catch((error: unknown) => {
        addToast({
          variant: 'error',
          title: 'Gagal memutar preview',
          message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
        });
      });
  };

  const handlePreviewSlot = (slot: GridSlot) => {
    if (slot.sample_id == null) {
      addToast({ variant: 'info', title: 'Belum ada sample', message: 'Pasang sample dulu untuk mendengar bunyi ini.' });
      return;
    }
    previewSampleAudio(slot.sample_id).catch(() => {
      addToast({ variant: 'error', title: 'Gagal memutar', message: 'Audio tidak dapat diputar.' });
    });
  };

  const selectPartForManager = (partId: number) => {
    setSelectedPartId(partId);
    managerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      {/* Breadcrumb + judul */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to={isTemplate ? '/templates/$songId' : '/songs/$songId'}
            params={{ songId: String(songId) }}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            {isTemplate ? '← Kembali ke Template' : '← Kembali ke Section'}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">
            Sequencer — Section: {sectionName}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Isi pola pukulan per Part — klik kotak step, panjang bebas, preview audio tersedia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyParts.length > 0 && !readOnly && (
            <span className="text-xs font-medium text-amber-600">Perubahan belum disimpan</span>
          )}
          {readOnly && (
            <Link
              to="/songs/$songId/play"
              params={{ songId: String(songId) }}
              className="inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 ring-1 ring-stone-300 ring-inset transition-colors hover:bg-stone-50"
            >
              Buka Launcher
            </Link>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <span className="font-semibold">🔒 Mode Lihat Saja{!isAuthenticated ? ' (Guest)' : ''}</span> — Kamu bisa
          melihat susunan pola pukulan, tapi tidak bisa mengedit.
          {!isAuthenticated && (
            <Link to="/login" className="ml-2 font-semibold text-brand-700 underline-offset-2 hover:underline">
              Login untuk Edit
            </Link>
          )}
        </div>
      )}

      <p className="mt-4 rounded-md border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600">
        <span className="font-semibold text-stone-800">Cara pakai:</span> klik kotak pada baris & kolom step untuk
        mengaktifkan/menonaktifkan bunyi — <span className="font-semibold">klik satu kotak hanya mengisi kotak itu</span>,
        kotak di kirinya tetap kosong (langkah istirahat, senyap). Jumlah baris tiap Part dinamis — tiap Part punya
        sejumlah SoundSlot (jenis bunyi, mis. Tak/Dung/Duk) yang bisa ditambah bebas. Slot sample boleh kosong dulu —
        playback tetap jalan, part tsb senyap. Tombol ▶ di kiri tiap baris memutar preview bunyi tsb sendirian (FR-SEQ-05).
      </p>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 ring-1 ring-stone-900/5">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={handleTogglePreview}>
            {preview.isPlaying ? '■ Stop Preview' : '▶ Play Preview'}
          </Button>
          <span className="text-xs text-stone-500">
            BPM {effectiveBpm}
            {bpmOverride !== null && (
              <span className="ml-1 font-semibold text-amber-700" title="BPM override section ini — berbeda dari BPM dasar Song">
                ★ (override, dasar {songBpm})
              </span>
            )}
            {' · '}
            {roundUpToStepMultiple(Math.max(...orderedParts.map((p) => stepCount(stepsOf(p))), 0))} step ditampilkan
            (1 step = 1/16 ketukan; kelipatan beat)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => handleBatchSteps(STEP_BATCH)}>
            + 4 Step
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => handleBatchSteps(-STEP_BATCH)}>
            − 4 Step
          </Button>
        </div>
      </div>

      {editPromptZone === 'grid' && (
        <LoginPromptInline action="mengubah pola pukulan" onDismiss={() => setEditPromptZone(null)} />
      )}

      {allPartsEmpty && (
        <p className="mt-4 rounded-md border border-dashed border-stone-300 bg-white p-3 text-xs text-stone-500">
          Belum ada jenis bunyi (SoundSlot) di Section ini — mulai dari nol: klik{' '}
          <span className="font-semibold text-stone-700">+ Tambah Bunyi</span> pada tiap Part untuk
          membuat bunyi pertama (mis. Tak dengan key T), lalu klik kotak step untuk mengisi pola.
        </p>
      )}

      {/* Grid terpadu semua Part */}
      <SequencerGrid
        parts={orderedParts.map((part) => ({
          id: part.id,
          part: part.part,
          steps: part.steps ?? '',
          slots: part.sound_slots.map((slot) => ({
            id: slot.id,
            label: slot.label,
            key: slot.key,
            sample_id: slot.sample_id,
            sample: slot.sample ?? null,
          })),
        }))}
        stepsByPart={stepsByPart}
        onToggleCell={handleToggleCell}
        onPreviewSlot={handlePreviewSlot}
        onManagePart={selectPartForManager}
        onAddSlot={(partId) => {
          setSelectedPartId(partId);
          setFocusCreateSignal((n) => n + 1);
          managerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onClearPart={handleClearPart}
        readOnly={readOnly}
        onEditAttempt={() => setEditPromptZone('grid')}
        playheadIndex={preview.isPlaying ? preview.stepIndex : null}
        mutedParts={mutedParts}
        onToggleMute={(partKey) =>
          setMutedParts((prev) => {
            const next = new Set(prev);
            if (next.has(partKey)) next.delete(partKey);
            else next.add(partKey);
            return next;
          })
        }
      />

      {/* Aksi bawah */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!readOnly && (
          <Button type="button" onClick={handleSave} disabled={dirtyParts.length === 0 || saveStepsMutation.isPending}>
            Simpan Perubahan
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={handleTogglePreview}>
          ▶ Preview Section Ini (Semua Part)
        </Button>
        <Link
          to={isTemplate ? '/templates/$songId' : '/songs/$songId'}
          params={{ songId: String(songId) }}
          className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100"
        >
          ← Kembali ke Section
        </Link>
      </div>

      {/* Panel kelola SoundSlot untuk Part terpilih */}
      <div ref={managerRef} className="scroll-mt-6">
        {editPromptZone === 'slots' && (
          <LoginPromptInline action="mengubah jenis bunyi" onDismiss={() => setEditPromptZone(null)} />
        )}
        <SoundSlotManager
          key={selectedPart.id}
          partId={selectedPart.id}
          slots={selectedPart.sound_slots ?? []}
          onChanged={() => partsQuery.refetch()}
          readOnly={readOnly}
          onEditAttempt={() => setEditPromptZone('slots')}
          focusCreateSignal={focusCreateSignal}
        />
      </div>

      <p className="mt-2 text-xs text-stone-400">
        Kelola Bunyi di atas berlaku untuk {PART_LABELS[selectedPart.part] ?? selectedPart.part} — pilih Part lain
        lewat tombol “Kelola bunyi” pada subheader grid.
      </p>
    </div>
  );
}
