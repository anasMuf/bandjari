import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router'
import { useGetSongsId, usePostSongsIdDuplicate } from '../../api/endpoints/songs/songs'
import { useAuth } from '../../features/auth/AuthContext'
import { LoginPromptInline } from '../../features/auth/components/LoginPromptInline'
import { Button } from '../../components/atoms/Button'
import { useToast } from '../../components/molecules/Toast'
import { ApiError } from '../../api/mutator/custom-instance'
import type { SectionItem } from '../../features/section/components/SectionStrip'

export const Route = createFileRoute('/songs/$songId')({
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
 * Halaman viewer publik untuk satu Song — dipakai Guest melihat Song Template
 * System (AC-11). Section terbuka sebagai chip menuju Sequencer read-only.
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
    return <p className="p-6 text-sm text-gray-500">Memuat lagu...</p>;
  }

  if (songQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-800">Lagu tidak ditemukan atau tidak dapat diakses.</p>
          <Link to="/" className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500">
            Kembali ke beranda
          </Link>
        </div>
      </div>
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
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Beranda
        </Link>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{song.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {song.is_system_template ? 'Lagu Bawaan · ' : ''}BPM dasar: {song.bpm}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/songs/$songId/play"
              params={{ songId: String(id) }}
              className="inline-flex items-center justify-center rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-gray-700"
            >
              ▶ Mainkan
            </Link>
            <Button type="button" onClick={handleDuplicate} disabled={duplicateMutation.isPending}>
              Duplikasi ke Song Saya
            </Button>
          </div>
        </div>

        {showPrompt && !isAuthenticated && (
          <div className="mt-3 max-w-md">
            <LoginPromptInline action="menduplikasi lagu" onDismiss={() => setShowPrompt(false)} />
          </div>
        )}

        <section aria-label="Section" className="mt-8">
          <h3 className="text-sm font-semibold text-gray-900">Section</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(song.sections ?? [])
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((sec) => (
                <Link
                  key={sec.id}
                  to="/songs/$songId/sections/$sectionId"
                  params={{ songId: String(id), sectionId: String(sec.id) }}
                  className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-xs hover:border-indigo-300 hover:text-indigo-600"
                >
                  {sec.name}
                  <span className="text-xs text-gray-500">
                    {sec.bpm_override !== null ? `★${sec.bpm_override}` : song.bpm} BPM
                  </span>
                </Link>
              ))}
            {(!song.sections || song.sections.length === 0) && (
              <p className="text-sm text-gray-400">Lagu ini belum memiliki section.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
