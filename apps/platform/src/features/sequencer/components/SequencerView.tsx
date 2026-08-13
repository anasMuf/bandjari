import { useEffect, useState } from 'react';
import { useGetSongsId } from '../../../api/endpoints/songs/songs';
import { useGetSectionsIdParts, usePutSectionPartsId } from '../../../api/endpoints/section-parts/section-parts';
import type { DtoSuccessResponse } from '../../../api/model';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';
import { useAuth } from '../../auth/AuthContext';
import { LoginPromptInline } from '../../auth/components/LoginPromptInline';
import { StepGrid } from '../components/StepGrid';
import { SoundSlotManager, type SoundSlotData } from '../components/SoundSlotManager';
import { usePartPreview } from '../hooks/usePartPreview';

interface PartData {
  id: number;
  section_id: number;
  part: string;
  steps: string | null;
  sound_slots: SoundSlotData[];
}

const PART_LABELS: Record<string, string> = {
  rebana1: 'Rebana 1',
  rebana2: 'Rebana 2',
  rebana3: 'Rebana 3',
  rebana4: 'Rebana 4',
  bass: 'Bass',
};

interface SequencerViewProps {
  songId: number;
  sectionId: number;
  sectionName: string;
}

export function SequencerView({ songId, sectionId, sectionName }: SequencerViewProps) {
  const { addToast } = useToast();
  const { isAuthenticated } = useAuth();
  const partsQuery = useGetSectionsIdParts(sectionId);
  const songQuery = useGetSongsId(songId);
  const saveStepsMutation = usePutSectionPartsId();
  const preview = usePartPreview();

  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [steps, setSteps] = useState('');
  const [editPromptZone, setEditPromptZone] = useState<'slots' | 'grid' | null>(null);

  const parts = ((partsQuery.data?.data as DtoSuccessResponse | undefined)?.data ?? []) as PartData[];
  const sortedParts = [...parts].sort((a, b) => PART_LABELS[a.part]?.localeCompare(PART_LABELS[b.part] ?? '') ?? 0);
  const selectedPart = sortedParts.find((p) => p.id === selectedPartId) ?? sortedParts[0];

  useEffect(() => {
    if (!selectedPartId && sortedParts.length > 0) {
      setSelectedPartId(sortedParts[0].id);
    }
  }, [sortedParts, selectedPartId]);

  useEffect(() => {
    if (selectedPart) {
      setSteps(selectedPart.steps ?? '');
    }
  }, [selectedPart]);

  if (partsQuery.isLoading || songQuery.isLoading) {
    return <p className="text-sm text-gray-500">Memuat sequencer...</p>;
  }

  if (partsQuery.isError) {
    return (
      <div role="status" className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-800">Section tidak ditemukan atau tidak dapat diakses.</p>
      </div>
    );
  }

  if (!selectedPart) {
    return (
      <p role="status" className="text-sm text-gray-500">
        Section ini belum memiliki bagian instrumen.
      </p>
    );
  }

  const isDirty = steps !== (selectedPart.steps ?? '');
  const songResp = songQuery.data?.data;
  const songData =
    songResp && 'data' in songResp ? (songResp.data as { bpm?: number; is_system_template?: boolean }) : undefined;
  const effectiveBpm = songData?.bpm ?? 90;
  // Song Template System read-only bagi siapapun (FR-SONG-08); Guest read-only semua (FR-AUTH-06).
  const readOnly = !isAuthenticated || songData?.is_system_template === true;

  const handleSaveSteps = () => {
    saveStepsMutation.mutate(
      { id: selectedPart.id, data: { steps: { set: true, value: steps } } },
      {
        onSuccess: () => {
          addToast({ variant: 'success', title: 'Steps tersimpan', message: 'Pola pukulan diperbarui.' });
          partsQuery.refetch();
        },
        onError: (error) => {
          addToast({
            variant: 'error',
            title: 'Gagal menyimpan steps',
            message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
          });
        },
      },
    );
  };

  const handleTogglePreview = () => {
    if (preview.isPlaying) {
      preview.stop();
      return;
    }
    preview
      .play(selectedPart.sound_slots ?? [], steps || '', effectiveBpm)
      .catch((error: unknown) => {
        addToast({
          variant: 'error',
          title: 'Gagal memutar preview',
          message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
        });
      });
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">{sectionName}</h2>
          <p className="mt-1 text-sm text-gray-500">Sequencer Mode · {effectiveBpm} BPM</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && !readOnly && (
            <span className="text-xs font-medium text-amber-600">Perubahan belum disimpan</span>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleTogglePreview}
            aria-label={preview.isPlaying ? 'Hentikan preview' : 'Putar preview part ini'}
          >
            {preview.isPlaying ? '■ Hentikan' : '▶ Preview'}
          </Button>
          {!readOnly && (
            <Button type="button" onClick={handleSaveSteps} disabled={!isDirty || saveStepsMutation.isPending}>
              Simpan Steps
            </Button>
          )}
        </div>
      </div>

      {readOnly && (
        <p className="mt-3 rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-600">
          Mode lihat-saja{!isAuthenticated ? ' — Anda menjelajah sebagai pengunjung' : ''}. Kontrol edit
          dinonaktifkan; duplikasi lagu ini ke "Lagu Saya" untuk memodifikasinya.
        </p>
      )}

      <div role="tablist" aria-label="Bagian instrumen" className="mt-6 flex flex-wrap gap-1">
        {sortedParts.map((part) => (
          <button
            key={part.id}
            type="button"
            role="tab"
            aria-selected={part.id === selectedPart.id}
            onClick={() => setSelectedPartId(part.id)}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
              part.id === selectedPart.id
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 ring-inset hover:bg-gray-50',
            ].join(' ')}
          >
            {PART_LABELS[part.part] ?? part.part}
          </button>
        ))}
      </div>

      {editPromptZone === 'slots' && (
        <LoginPromptInline action="mengubah jenis bunyi" onDismiss={() => setEditPromptZone(null)} />
      )}
      <SoundSlotManager
        partId={selectedPart.id}
        slots={selectedPart.sound_slots ?? []}
        onChanged={() => partsQuery.refetch()}
        readOnly={readOnly}
        onEditAttempt={() => setEditPromptZone('slots')}
      />
      {editPromptZone === 'grid' && (
        <LoginPromptInline action="mengubah pola pukulan" onDismiss={() => setEditPromptZone(null)} />
      )}
      <StepGrid
        slots={selectedPart.sound_slots ?? []}
        steps={steps}
        onChange={setSteps}
        readOnly={readOnly}
        onEditAttempt={() => setEditPromptZone('grid')}
      />
    </div>
  );
}
