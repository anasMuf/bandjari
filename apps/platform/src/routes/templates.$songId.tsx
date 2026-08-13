import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router'
import { useGetSongsId, usePostSongsIdDuplicate } from '../api/endpoints/songs/songs'
import { useAuth } from '../features/auth/AuthContext'
import { LoginPromptInline } from '../features/auth/components/LoginPromptInline'
import { SongDetailView } from '../features/song/components/SongDetailView'
import { Button } from '../components/atoms/Button'
import { useToast } from '../components/molecules/Toast'
import { ApiError } from '../api/mutator/custom-instance'
import type { SectionItem } from '../features/section/components/SectionStrip'

export const Route = createFileRoute('/templates/$songId')({
  component: PublicSongViewPage,
})

interface SongDetail {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
  sections?: SectionItem[];
}

/**
 * Halaman viewer publik untuk Song Template System (AC-11, layar 2 wireframe):
 * banner Mode Lihat Saja untuk Guest, strip section read-only, dan duplikasi
 * ke "Lagu Saya" bagi pengguna login.
 */
function PublicSongViewPage() {
  const { songId } = Route.useParams()
  const id = Number(songId)
  const songQuery = useGetSongsId(id)
  const { isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const duplicateMutation = usePostSongsIdDuplicate()
  const [showPrompt, setShowPrompt] = useState(false)

  if (songQuery.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-stone-500">Memuat lagu...</p>
      </main>
    );
  }

  if (songQuery.isError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-medium text-red-800">Lagu tidak ditemukan atau tidak dapat diakses.</p>
            <Link to="/" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:text-brand-600">
              Kembali ke beranda
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const resp = songQuery.data?.data;
  const song = resp && 'data' in resp ? (resp.data as SongDetail) : undefined;
  if (!song) return null;

  const handleDuplicate = () => {
    if (!isAuthenticated) {
      setShowPrompt(true);
      return;
    }
    duplicateMutation.mutate(
      { id: song.id },
      {
        onSuccess: () => {
          addToast({
            variant: 'success',
            title: 'Lagu diduplikasi',
            message: 'Salinan tersimpan di "Lagu Saya".',
          });
        },
        onError: (error) => {
          addToast({
            variant: 'error',
            title: 'Gagal menduplikasi',
            message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
          });
        },
      },
    );
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {showPrompt && !isAuthenticated && (
        <div className="mb-4 max-w-md">
          <LoginPromptInline action="menduplikasi lagu" onDismiss={() => setShowPrompt(false)} />
        </div>
      )}

      <SongDetailView
        song={song}
        back={
          <Link to="/" className="text-sm text-stone-500 hover:text-stone-700">
            ← Beranda
          </Link>
        }
        banner={
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-amber-800">🔒 Mode Lihat Saja</span>
              <span className="text-amber-800">
                — Kamu sedang melihat Song Template System{' '}
                <span className="font-semibold">{song.name}</span>. Kontrol edit dinonaktifkan.
              </span>
              {isAuthenticated ? (
                <Button type="button" size="sm" onClick={handleDuplicate} disabled={duplicateMutation.isPending}>
                  Duplikasi ke Song Saya
                </Button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-md bg-brand-700 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
                >
                  Login untuk Edit
                </Link>
              )}
            </p>
          </div>
        }
        readOnly
        onEditAttempt={() => setShowPrompt(true)}
        onChanged={() => songQuery.refetch()}
      />
    </main>
  );
}
