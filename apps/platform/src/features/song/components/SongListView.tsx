import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  useGetSongs,
  usePostSongs,
  usePutSongsId,
  useDeleteSongsId,
  usePostSongsIdDuplicate,
  usePutSongsIdVisibility,
} from '../../../api/endpoints/songs/songs';
import type { DtoSuccessResponse } from '../../../api/model';
import { Button } from '../../../components/atoms/Button';
import { Badge } from '../../../components/atoms/Badge';
import { FormField } from '../../../components/molecules/FormField';
import { ConfirmDialog } from '../../../components/molecules/ConfirmDialog';
import { PageHeader } from '../../../components/molecules/PageHeader';
import { EmptyState } from '../../../components/molecules/EmptyState';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';
import { useAuth } from '../../auth/AuthContext';

interface SongItem {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
  /** Status publikasi: "public" tampil di Explore, "private" hanya untuk pemilik (FR-VIS). */
  visibility?: string;
  section_count?: number;
  updated_at?: string;
}

interface SongFormData {
  name: string;
  bpm: number;
  /** Admin: jadikan Song Template System (FR-ROLE). */
  asTemplate: boolean;
  /** Admin pemilik: status publikasi lagu (FR-VIS). */
  visibility: 'public' | 'private';
}

const emptyForm: SongFormData = { name: '', bpm: 90, asTemplate: false, visibility: 'private' };

/** "diubah 2 hari lalu" — meta relatif singkat untuk daftar Song. */
function formatRelativeTime(iso?: string): string {
  if (!iso) return 'baru saja';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'baru saja';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `diubah ${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `diubah ${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 30) return `diubah ${days} hari lalu`;
  return `diubah ${new Date(iso).toLocaleDateString('id-ID')}`;
}

export function SongListView() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const songsQuery = useGetSongs();
  const createMutation = usePostSongs();
  const updateMutation = usePutSongsId();
  const deleteMutation = useDeleteSongsId();
  const duplicateMutation = usePostSongsIdDuplicate();
  const visibilityMutation = usePutSongsIdVisibility();

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
    setForm({
      name: song.name,
      bpm: song.bpm,
      asTemplate: song.is_system_template,
      visibility: song.visibility === 'public' ? 'public' : 'private',
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      bpm: Number(form.bpm),
      is_system_template: form.asTemplate || undefined,
      // FR-VIS: hanya dikirim saat buat (edit memakai endpoint visibility terpisah).
      visibility: !editing && isAdmin ? form.visibility : undefined,
    };

    // FR-VIS: admin pemilik boleh mengubah status public/private — lewat endpoint
    // terpisah agar guard aksesnya eksplisit (bukan tercampur guard name/bpm).
    const visibilityChanged =
      !!editing &&
      isAdmin &&
      form.visibility !== (editing.visibility === 'public' ? 'public' : 'private');

    const applyVisibility = () => {
      if (!visibilityChanged || !editing) return;
      visibilityMutation.mutate(
        { id: editing.id, data: { visibility: form.visibility } },
        {
          onSuccess: () => {
            notify('Status lagu diperbarui', form.visibility === 'public' ? 'Lagu kini tampil di Explore.' : 'Lagu kini privat — hanya Anda yang bisa melihatnya.');
            refresh();
          },
          onError: (error) => showError(error, 'Gagal memperbarui status lagu'),
        },
      );
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            notify('Lagu diperbarui', 'Perubahan berhasil disimpan.');
            setShowForm(false);
            refresh();
            applyVisibility();
          },
          onError: (error) => showError(error, 'Gagal memperbarui lagu'),
        },
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          // "Simpan & Lanjut ke Section →" (FR-SONG-01): setelah dibuat, langsung
          // menuju halaman detail untuk menyusun Section (Flow 5.1).
          onSuccess: (response) => {
            const body = response.data as DtoSuccessResponse;
            const created = body?.data as { id?: number } | undefined;
            notify('Lagu dibuat', 'Lagu baru berhasil ditambahkan — lanjut susun Section.');
            setShowForm(false);
            if (created?.id) {
              // Template dikelola lewat halaman template (banner Mode Admin);
              // song biasa langsung ke halaman kelola section.
              navigate({
                to: payload.is_system_template ? '/templates/$songId' : '/songs/$songId',
                params: { songId: String(created.id) },
              });
            } else {
              refresh();
            }
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
    return <p className="text-sm text-stone-500">Memuat daftar lagu...</p>;
  }

  return (
    <div>
      <PageHeader
        title="Lagu Saya"
        subtitle="Daftar seluruh Song milikmu — susun lagu Al-Banjari beserta section & pola pukulannya."
        actions={
          <Button type="button" onClick={openCreate}>
            + Buat Song Baru
          </Button>
        }
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-lg bg-white p-4 ring-1 ring-stone-900/5">
          <h2 className="text-sm font-semibold text-stone-900">
            {editing ? 'Edit Lagu' : 'Song Baru'}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <FormField
                id="name"
                name="name"
                type="text"
                label="Nama Song"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder='mis. "Ya Habibal Qolbi"'
                required
                maxLength={255}
              />
            </div>
            <FormField
              id="bpm"
              name="bpm"
              type="number"
              label="BPM"
              value={String(form.bpm)}
              onChange={(e) => setForm({ ...form, bpm: Number(e.target.value) })}
              placeholder="90"
              required
              min={20}
              max={400}
            />
          </div>
          {isAdmin && !editing && (
            <label className="mt-4 flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.asTemplate}
                onChange={(e) => setForm({ ...form, asTemplate: e.target.checked })}
                className="size-4 rounded border-stone-300 accent-brand-700"
              />
              Jadikan Song Template System (dapat dilihat semua orang, hanya admin yang bisa mengelola)
            </label>
          )}
          {isAdmin && !form.asTemplate && (
            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-stone-700">Status Publikasi</legend>
              <p className="mt-0.5 text-xs text-stone-500">
                Publik = lagu tampil di Explore beserta nama Anda sebagai penulis; privat = hanya Anda yang bisa melihat (FR-VIS).
              </p>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={form.visibility === 'public'}
                    onChange={() => setForm({ ...form, visibility: 'public' })}
                    className="size-4 border-stone-300 accent-brand-700"
                  />
                  Publik
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={form.visibility === 'private'}
                    onChange={() => setForm({ ...form, visibility: 'private' })}
                    className="size-4 border-stone-300 accent-brand-700"
                  />
                  Privat
                </label>
              </div>
            </fieldset>
          )}
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Simpan' : 'Simpan & Lanjut ke Section →'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Batal
            </Button>
          </div>
        </form>
      )}

      {songs && songs.length === 0 && !showForm ? (
        <EmptyState
          icon="♪"
          title="Belum ada Song"
          description="Buat Song pertamamu untuk mulai menyusun pattern."
        >
          <Button type="button" onClick={openCreate}>
            + Buat Song Baru
          </Button>
        </EmptyState>
      ) : (
        <ul className="mt-6 divide-y divide-stone-100 overflow-hidden rounded-lg bg-white ring-1 ring-stone-900/5">
          {(songs ?? []).map((song) => (
            <li key={song.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <Link to="/songs/$songId" params={{ songId: String(song.id) }} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-stone-900 hover:text-brand-700">
                    {song.name}
                  </p>
                  {isAdmin && (
                    <Badge>{song.visibility === 'public' ? 'PUBLIK' : 'PRIVAT'}</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  BPM {song.bpm} · {song.section_count ?? 0} Section · {formatRelativeTime(song.updated_at)}
                  {isAdmin && song.visibility === 'public' && ' · tampil di Explore'}
                </p>
              </Link>
              <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:justify-end">
                <Link
                  to="/songs/$songId/play"
                  params={{ songId: String(song.id) }}
                  title="Mainkan (Launcher)"
                  aria-label={`Mainkan ${song.name}`}
                  className="inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-700/30 ring-inset transition-colors hover:bg-brand-50"
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
                <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(song)}>
                  Ubah
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
