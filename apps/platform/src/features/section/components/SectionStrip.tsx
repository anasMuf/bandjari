import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  usePostSongsSongIdSections,
  usePutSectionsId,
  usePutSectionsIdReorder,
  useDeleteSectionsId,
  usePostSectionsIdDuplicate,
} from '../../../api/endpoints/sections/sections';
import { Button } from '../../../components/atoms/Button';
import { FormField } from '../../../components/molecules/FormField';
import { ConfirmDialog } from '../../../components/molecules/ConfirmDialog';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';

export interface SectionItem {
  id: number;
  song_id: number;
  name: string;
  order_index: number;
  bpm_override: number | null;
}

interface SectionStripProps {
  songId: number;
  songBpm: number;
  sections: SectionItem[];
  onChanged: () => void;
}

export function SectionStrip({ songId, songBpm, sections, onChanged }: SectionStripProps) {
  const { addToast } = useToast();
  const createMutation = usePostSongsSongIdSections();
  const updateMutation = usePutSectionsId();
  const reorderMutation = usePutSectionsIdReorder();
  const deleteMutation = useDeleteSectionsId();
  const duplicateMutation = usePostSectionsIdDuplicate();

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<SectionItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editBpm, setEditBpm] = useState('');
  const [deleting, setDeleting] = useState<SectionItem | null>(null);
  const [dragged, setDragged] = useState<SectionItem | null>(null);

  const notify = (title: string, message: string) =>
    addToast({ variant: 'success', title, message });
  const showError = (error: unknown, title: string) =>
    addToast({
      variant: 'error',
      title,
      message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
    });

  const sorted = [...sections].sort((a, b) => a.order_index - b.order_index);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate(
      { songId, data: { name: newName.trim() } },
      {
        onSuccess: () => {
          notify('Section dibuat', '5 bagian instrumen otomatis disiapkan.');
          setNewName('');
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal menambah section'),
      },
    );
  };

  const startEdit = (sec: SectionItem) => {
    setEditing(sec);
    setEditName(sec.name);
    setEditBpm(sec.bpm_override !== null ? String(sec.bpm_override) : '');
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const data: { name: string; bpm_override?: { set: boolean; value?: number } } = { name: editName.trim() };
    if (editBpm === '') {
      // kosongkan override → ikut BPM Song (set=true tanpa value)
      data.bpm_override = { set: true };
    } else {
      const val = Number(editBpm);
      if (val >= 20 && val <= 400) data.bpm_override = { set: true, value: val };
    }
    updateMutation.mutate(
      { id: editing.id, data },
      {
        onSuccess: () => {
          notify('Section diperbarui', 'Perubahan tersimpan.');
          setEditing(null);
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal memperbarui section'),
      },
    );
  };

  const move = (sec: SectionItem, newIndex: number) => {
    reorderMutation.mutate(
      { id: sec.id, data: { order_index: newIndex } },
      {
        onSuccess: () => onChanged(),
        onError: (error) => showError(error, 'Gagal mengubah urutan section'),
      },
    );
  };

  const handleDrop = (target: SectionItem) => {
    if (dragged && dragged.id !== target.id) {
      move(dragged, sorted.findIndex((s) => s.id === target.id));
    }
    setDragged(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          notify('Section dihapus', 'Seluruh pola pukulan di dalamnya ikut terhapus.');
          setDeleting(null);
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal menghapus section'),
      },
    );
  };

  const handleDuplicate = (sec: SectionItem) => {
    duplicateMutation.mutate(
      { id: sec.id },
      {
        onSuccess: () => {
          notify('Section diduplikasi', 'Salinan ditambahkan di akhir urutan.');
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal menduplikasi section'),
      },
    );
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Section</h3>
        <span className="text-xs text-gray-500">Seret chip untuk mengubah urutan</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {sorted.map((sec) => (
          <div
            key={sec.id}
            draggable
            onDragStart={() => setDragged(sec)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(sec)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm shadow-xs transition-colors ${
              dragged?.id === sec.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
            } cursor-grab`}
          >
            <Link
              to="/songs/$songId/sections/$sectionId"
              params={{ songId: String(songId), sectionId: String(sec.id) }}
              className="font-medium text-gray-900 hover:text-indigo-600 hover:underline"
              title="Buka Sequencer Mode"
            >
              {sec.name}
            </Link>
            <span className="text-xs text-gray-500">
              {sec.bpm_override !== null ? (
                <span className="font-semibold text-indigo-600">★{sec.bpm_override}</span>
              ) : (
                <span>{songBpm}</span>
              )}{' '}
              BPM
            </span>
            <div className="ml-1 flex items-center gap-0.5">
              <button
                type="button"
                title="Naikkan urutan"
                className="rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                onClick={() => move(sec, Math.max(0, sec.order_index - 1))}
              >
                ▲
              </button>
              <button
                type="button"
                title="Turunkan urutan"
                className="rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                onClick={() => move(sec, sec.order_index + 1)}
              >
                ▼
              </button>
              <button
                type="button"
                className="rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                title="Edit section"
                onClick={() => startEdit(sec)}
              >
                ✎
              </button>
              <button
                type="button"
                className="rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                title="Duplikasi section"
                onClick={() => handleDuplicate(sec)}
              >
                ⧉
              </button>
              <button
                type="button"
                className="rounded px-1 text-gray-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                title="Hapus section"
                onClick={() => setDeleting(sec)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {sections.length === 0 && (
          <p className="text-sm text-gray-400">Belum ada section — tambahkan yang pertama.</p>
        )}
      </div>

      {editing && (
        <form
          onSubmit={handleUpdate}
          className="mt-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-900/5"
        >
          <h4 className="text-sm font-semibold text-gray-900">Edit Section: {editing.name}</h4>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <FormField
                id="edit-name"
                name="edit-name"
                type="text"
                label="Nama section"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <FormField
              id="edit-bpm"
              name="edit-bpm"
              type="number"
              label={`BPM override (kosongkan = ikut ${songBpm})`}
              value={editBpm}
              onChange={(e) => setEditBpm(e.target.value)}
              min={20}
              max={400}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={updateMutation.isPending}>
              Simpan
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Batal
            </Button>
          </div>
        </form>
      )}

      {!editing && (
        <form onSubmit={handleCreate} className="mt-4 flex items-end gap-2">
          <div className="flex-1 max-w-xs">
            <FormField
              id="new-section"
              name="new-section"
              type="text"
              label="Nama section baru"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="mis. Awalan"
              required
              maxLength={255}
            />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            + Tambah Section
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Hapus section"
        description={`Yakin menghapus "${deleting?.name}"? Seluruh SectionPart & pola pukulannya ikut terhapus.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
