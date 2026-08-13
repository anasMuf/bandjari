import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  useGetSongs,
  usePostSongs,
  usePutSongsId,
  useDeleteSongsId,
  usePostSongsIdDuplicate,
} from '../../../api/endpoints/songs/songs';
import type { DtoSuccessResponse } from '../../../api/model';
import { Button } from '../../../components/atoms/Button';
import { FormField } from '../../../components/molecules/FormField';
import { ConfirmDialog } from '../../../components/molecules/ConfirmDialog';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';

interface SongItem {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
}

interface SongFormData {
  name: string;
  bpm: number;
}

const emptyForm: SongFormData = { name: '', bpm: 90 };

export function SongListView() {
  const { addToast } = useToast();
  const songsQuery = useGetSongs();
  const createMutation = usePostSongs();
  const updateMutation = usePutSongsId();
  const deleteMutation = useDeleteSongsId();
  const duplicateMutation = usePostSongsIdDuplicate();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SongItem | null>(null);
  const [form, setForm] = useState<SongFormData>(emptyForm);
  const [deleting, setDeleting] = useState<SongItem | null>(null);

  const songs = (songsQuery.data?.data as DtoSuccessResponse | undefined)?.data as
    | SongItem[]
    | undefined;

  const refresh = () => {
    songsQuery.refetch();
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (song: SongItem) => {
    setEditing(song);
    setForm({ name: song.name, bpm: song.bpm });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: form.name, bpm: Number(form.bpm) };
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            notify('Lagu diperbarui', 'Perubahan berhasil disimpan.');
            setShowForm(false);
            refresh();
          },
          onError: (error) => showError(error, 'Gagal memperbarui lagu'),
        },
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            notify('Lagu dibuat', 'Lagu baru berhasil ditambahkan.');
            setShowForm(false);
            refresh();
          },
          onError: (error) => showError(error, 'Gagal membuat lagu'),
        },
      );
    }
  };

  const showError = (error: unknown, title: string) => {
    addToast({
      variant: 'error',
      title,
      message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
    });
  };

  const notify = (title: string, message: string) => {
    addToast({ variant: 'success', title, message });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          notify('Lagu dihapus', 'Lagu beserta seluruh section-nya telah dihapus.');
          setDeleting(null);
          refresh();
        },
        onError: (error) => showError(error, 'Gagal menghapus lagu'),
      },
    );
  };

  const handleDuplicate = (song: SongItem) => {
    duplicateMutation.mutate(
      { id: song.id },
      {
        onSuccess: () => {
          notify('Lagu diduplikasi', 'Salinan lagu berhasil dibuat.');
          refresh();
        },
        onError: (error) => showError(error, 'Gagal menduplikasi lagu'),
      },
    );
  };

  if (songsQuery.isLoading) {
    return <p className="text-sm text-gray-500">Memuat daftar lagu...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Lagu Saya</h2>
          <p className="mt-1 text-sm text-gray-500">
            Susun lagu Al-Banjari beserta section dan pola pukulannya.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          + Buat Lagu Baru
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-900/5"
        >
          <h3 className="text-sm font-semibold text-gray-900">
            {editing ? 'Edit Lagu' : 'Buat Lagu Baru'}
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <FormField
                id="name"
                name="name"
                type="text"
                label="Nama lagu"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                maxLength={255}
              />
            </div>
            <FormField
              id="bpm"
              name="bpm"
              type="number"
              label="BPM dasar"
              value={String(form.bpm)}
              onChange={(e) => setForm({ ...form, bpm: Number(e.target.value) })}
              required
              min={20}
              max={400}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Simpan' : 'Buat'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Batal
            </Button>
          </div>
        </form>
      )}

      {songs && songs.length === 0 && !showForm ? (
        <div className="mt-10 rounded-lg border-2 border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm font-medium text-gray-900">Belum ada Song</p>
          <p className="mt-1 text-sm text-gray-500">
            Buat lagu pertama Anda untuk mulai menyusun pola pukulan.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          {(songs ?? []).map((song) => (
            <li key={song.id} className="flex items-center justify-between px-4 py-4">
              <div>
                <Link
                  to="/songs/$songId"
                  params={{ songId: String(song.id) }}
                  className="text-sm font-medium text-gray-900 hover:text-indigo-600 hover:underline"
                >
                  {song.name}
                </Link>
                <p className="mt-0.5 text-xs text-gray-500">{song.bpm} BPM</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/songs/$songId/play"
                  params={{ songId: String(song.id) }}
                  title="Mainkan (Launcher)"
                  aria-label={`Mainkan ${song.name}`}
                  className="inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-900 ring-1 ring-gray-300 ring-inset transition-colors hover:bg-gray-50"
                >
                  ▶ Mainkan
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDuplicate(song)}
                  disabled={duplicateMutation.isPending}
                >
                  Duplikasi
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(song)}>
                  Edit
                </Button>
                <Button type="button" variant="danger" size="sm" onClick={() => setDeleting(song)}>
                  Hapus
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Hapus lagu"
        description={`Yakin menghapus "${deleting?.name}"? Seluruh section dan pola pukulan di dalamnya ikut terhapus.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
