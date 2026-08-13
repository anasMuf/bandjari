import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  usePutSectionsId,
  useDeleteSectionsId,
  usePostSectionsIdDuplicate,
} from '../../../api/endpoints/sections/sections';
import { Button } from '../../../components/atoms/Button';
import { ConfirmDialog } from '../../../components/molecules/ConfirmDialog';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';
import type { SectionItem } from './SectionStrip';

interface SectionDetailPanelProps {
  songId: number;
  songBpm: number;
  section: SectionItem;
  onChanged: () => void;
  /** Mode lihat-saja (Guest / Song Template): aksi edit memicu onEditAttempt. */
  readOnly?: boolean;
  onEditAttempt?: () => void;
}

/**
 * Panel "Section Terpilih" (layar 2 wireframe): aksi buka di Sequencer /
 * duplikasi / hapus + pengaturan nama & BPM override (FR-SEC-05/07/08/09).
 */
export function SectionDetailPanel({
  songId,
  songBpm,
  section,
  onChanged,
  readOnly = false,
  onEditAttempt,
}: SectionDetailPanelProps) {
  const { addToast } = useToast();
  const updateMutation = usePutSectionsId();
  const deleteMutation = useDeleteSectionsId();
  const duplicateMutation = usePostSectionsIdDuplicate();

  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState(section.name);
  const [bpmValue, setBpmValue] = useState(
    section.bpm_override !== null ? String(section.bpm_override) : '',
  );
  const [deleting, setDeleting] = useState(false);

  const showError = (error: unknown, title: string) =>
    addToast({
      variant: 'error',
      title,
      message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
    });

  const guardEdit = (): boolean => {
    if (readOnly) {
      onEditAttempt?.();
      return false;
    }
    return true;
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameValue.trim()) return;
    updateMutation.mutate(
      { id: section.id, data: { name: nameValue.trim() } },
      {
        onSuccess: () => {
          addToast({ variant: 'success', title: 'Nama section diperbarui', message: 'Perubahan tersimpan.' });
          setRenaming(false);
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal mengubah nama section'),
      },
    );
  };

  const applyBpmOverride = () => {
    if (!guardEdit()) return;
    const data: { bpm_override?: { set: boolean; value?: number } } = {};
    if (bpmValue === '') {
      // Kosong = ikut BPM dasar Song (set=true tanpa value → clear).
      data.bpm_override = { set: true };
    } else {
      const val = Number(bpmValue);
      if (val >= 20 && val <= 400) data.bpm_override = { set: true, value: val };
      else {
        addToast({ variant: 'error', title: 'BPM tidak valid', message: 'Masukkan angka 20–400 atau kosongkan.' });
        return;
      }
    }
    updateMutation.mutate(
      { id: section.id, data },
      {
        onSuccess: () => {
          addToast({ variant: 'success', title: 'Tempo diperbarui', message: 'BPM override section tersimpan.' });
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal menyimpan BPM override'),
      },
    );
  };

  const handleDuplicate = () => {
    if (!guardEdit()) return;
    duplicateMutation.mutate(
      { id: section.id },
      {
        onSuccess: () => {
          addToast({ variant: 'success', title: 'Section diduplikasi', message: 'Salinan ditambahkan di akhir urutan.' });
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal menduplikasi section'),
      },
    );
  };

  const confirmDelete = () => {
    deleteMutation.mutate(
      { id: section.id },
      {
        onSuccess: () => {
          addToast({ variant: 'success', title: 'Section dihapus', message: 'Seluruh pola pukulan di dalamnya ikut terhapus.' });
          setDeleting(false);
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal menghapus section'),
      },
    );
  };

  return (
    <div className="rounded-lg bg-white p-5 ring-1 ring-stone-900/5">
      <h2 className="text-base font-semibold text-stone-900">Section Terpilih: {section.name}</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/songs/$songId/sections/$sectionId"
          params={{ songId: String(songId), sectionId: String(section.id) }}
          className="inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-semibold text-stone-900 ring-1 ring-stone-300 ring-inset transition-colors hover:bg-stone-50"
        >
          Buka di Sequencer Mode →
        </Link>
        <Button type="button" size="sm" variant="secondary" onClick={handleDuplicate} disabled={duplicateMutation.isPending}>
          Duplikasi Section
        </Button>
        <Button type="button" size="sm" variant="danger" onClick={() => guardEdit() && setDeleting(true)}>
          Hapus Section
        </Button>
      </div>

      <p className="mt-3 text-xs text-stone-500">
        Drag ⠿ pada strip di atas untuk mengatur ulang urutan (FR-SEC-04). Urutan ini menentukan
        susunan pad di Launcher Mode nanti — tapi saat live, pad tetap bisa dipicu di luar urutan.
      </p>

      {renaming ? (
        <form onSubmit={handleRename} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label htmlFor="section-rename" className="block text-sm/6 font-medium text-stone-900">
              Nama section
            </label>
            <input
              id="section-rename"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              required
              maxLength={255}
              className="mt-2 block w-full rounded-md bg-white px-3 py-2 text-sm text-stone-900 outline-1 -outline-offset-1 outline-stone-300 placeholder:text-stone-400 focus:outline-2 focus:-outline-offset-2 focus:outline-brand-700"
            />
          </div>
          <Button type="submit" size="sm" disabled={updateMutation.isPending}>
            Simpan
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
            Batal
          </Button>
        </form>
      ) : (
        !readOnly && (
          <button
            type="button"
            onClick={() => {
              setNameValue(section.name);
              setRenaming(true);
            }}
            className="mt-3 text-xs font-medium text-brand-700 underline-offset-2 hover:underline cursor-pointer"
          >
            ✎ Ubah nama section
          </button>
        )
      )}

      <div className="mt-4 rounded-md bg-stone-50 p-4">
        <h3 className="text-sm font-semibold text-stone-900">Tempo (BPM Override)</h3>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={20}
            max={400}
            value={bpmValue}
            onChange={(e) => setBpmValue(e.target.value)}
            placeholder={`ikut BPM Song (${songBpm})`}
            readOnly={readOnly}
            aria-label={`BPM override section ${section.name}`}
            onFocus={() => {
              if (readOnly) {
                onEditAttempt?.();
              }
            }}
            className="block w-36 rounded-md bg-white px-3 py-2 text-sm text-stone-900 outline-1 -outline-offset-1 outline-stone-300 placeholder:text-stone-400 focus:outline-2 focus:-outline-offset-2 focus:outline-brand-700"
          />
          {!readOnly && (
            <Button type="button" size="sm" onClick={applyBpmOverride} disabled={updateMutation.isPending}>
              Terapkan
            </Button>
          )}
          <span className="text-xs text-stone-500">
            Kosong = ikut BPM dasar Song ({songBpm}). Isi angka untuk override khusus Section ini.
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        title="Hapus section"
        description={`Yakin menghapus "${section.name}"? Seluruh SectionPart & pola pukulannya ikut terhapus.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}
