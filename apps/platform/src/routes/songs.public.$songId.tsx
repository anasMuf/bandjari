import { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useGetSongsId, usePostSongsIdDuplicate } from '../api/endpoints/songs/songs'
import { useAuth } from '../features/auth/AuthContext'
import { LoginPromptInline } from '../features/auth/components/LoginPromptInline'
import { SongDetailView } from '../features/song/components/SongDetailView'
import { Button } from '../components/atoms/Button'
import { useToast } from '../components/molecules/Toast'
import { ApiError } from '../api/mutator/custom-instance'
import type { SectionItem } from '../features/section/components/SectionStrip'
import { seoMeta } from '../lib/seo'

export const Route = createFileRoute('/songs/public/$songId')({
  head: ({ match }) =>
    seoMeta({
      title: 'Lagu Publik Pola Rebana Al-Banjari | BandJari',
      description:
        'Lihat pola pukulan rebana Al-Banjari publik dari komunitas — bebas dimainkan tanpa login, duplikasi untuk menyusun pola sendiri.',
      pathname: match.pathname,
    }),
  component: PublicSongViewPage,
})

interface SongDetail {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
  /** Nama author — tampil di banner viewer (FR-VIS). */
  author_name?: string;
  sections?: SectionItem[];
}

/**
 * Viewer publik untuk lagu ber-status public (FR-VIS): banner Mode Lihat Saja,
 * strip section read-only, dan duplikasi ke "Lagu Saya" bagi pengguna login.
 * Akses lintas-user dimungkinkan karena visibility=public — sama seperti
 * Song Template System, tapi dengan atribusi author.
 */
function PublicSongViewPage() {
  const { songId } = Route.useParams()
  const id = Number(songId)
  const songQuery = useGetSongsId(id)
  const { isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const duplicateMutation = usePostSongsIdDuplicate()
  const [showPrompt, setShowPrompt] = useState(false)

  const resp = songQuery.data?.data;
  const song = resp && 'data' in resp ? (resp.data as SongDetail) : undefined;

  // Title tab/crawler dinamis pakai nama lagu setelah data termuat.
  useEffect(() => {
    if (song?.name) {
      document.title = `${song.name} | BandJari`
    }
  }, [song?.name])

  if (songQuery.isLoading) {
    return (
      <div className="min-h-screen bg-stone-100">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm text-stone-500">Memuat lagu...</p>
        </main>
      </div>
    );
  }

  if (songQuery.isError) {
    return (
      <div className="min-h-screen bg-stone-100">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm font-medium text-red-800">Lagu tidak ditemukan atau tidak dapat diakses.</p>
              <Link to="/explore" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:text-brand-600">
                Kembali ke Explore
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
    <div className="min-h-screen bg-stone-100">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {showPrompt && !isAuthenticated && (
        <div className="mb-4 max-w-md">
          <LoginPromptInline action="menduplikasi lagu" onDismiss={() => setShowPrompt(false)} />
        </div>
      )}

      <SongDetailView
        song={song}
        back={
          <Link
            to="/explore"
            aria-label="Kembali ke Explore"
            className="inline-flex items-center text-sm text-stone-500 hover:text-stone-700"
          >
            <ArrowLeft className="size-4 sm:hidden" aria-hidden="true" />
            <span className="max-sm:hidden">← Explore</span>
          </Link>
        }
        banner={
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-amber-800">🔒 Mode Lihat Saja</span>
              <span className="text-amber-800">
                — Lagu publik oleh {song.author_name || 'pengguna BandJari'}. Kontrol edit
                dinonaktifkan; buka lewat menu Explore.
              </span>
              {isAuthenticated && (
                <Button type="button" size="sm" onClick={handleDuplicate} disabled={duplicateMutation.isPending}>
                  Duplikasi ke Song Saya
                </Button>
              )}
            </p>
          </div>
        }
        readOnly
        onEditAttempt={() => setShowPrompt(true)}
        onChanged={() => songQuery.refetch()}
      />
      </main>
    </div>
  );
}
