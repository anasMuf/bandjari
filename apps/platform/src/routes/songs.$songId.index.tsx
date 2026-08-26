import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useGetSongsId } from '../api/endpoints/songs/songs'
import { useAuth } from '../features/auth/AuthContext'
import { SongDetailView } from '../features/song/components/SongDetailView'
import { LoginPromptInline } from '../features/auth/components/LoginPromptInline'
import type { SectionItem } from '../features/section/components/SectionStrip'
import { useState } from 'react'

export const Route = createFileRoute('/songs/$songId/')({
  component: SongDetailPage,
})

interface SongDetail {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
  /** Pemilik lagu — menentukan apakah user login berhak mengedit (FR-VIS). */
  user_id?: number | null;
  sections?: SectionItem[];
}

/**
 * Halaman kelola lagu milik user (layar 2 wireframe): strip Section + panel
 * Section Terpilih + Ringkasan Song. Untuk Song Template, arahkan ke halaman template.
 */
function SongDetailPage() {
  const { songId } = Route.useParams()
  const id = Number(songId)
  const songQuery = useGetSongsId(id)
  const { isAuthenticated, isAdmin, user } = useAuth()
  const [showPrompt, setShowPrompt] = useState(false)

  if (songQuery.isLoading) {
    return <p className="text-sm text-stone-500">Memuat detail lagu...</p>;
  }

  if (songQuery.isError || !isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          {isAuthenticated ? (
            <>
              <p className="text-sm font-medium text-red-800">Lagu tidak ditemukan atau tidak dapat diakses.</p>
              <Link to="/project" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:text-brand-600">
                Kembali ke daftar lagu
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-red-800">Lagu ini milik pengguna lain.</p>
              <p className="mt-1 text-xs text-red-700">Masuk untuk mengelola lagu Anda.</p>
              <Link
                to="/login"
                className="mt-3 inline-flex items-center justify-center rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Masuk
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const resp = songQuery.data?.data;
  const song = resp && 'data' in resp ? (resp.data as SongDetail) : undefined;
  // Pemilik lagu (login) — lagu publik milik user lain tetap read-only (FR-VIS).
  const isOwner = isAuthenticated && user?.id != null && song?.user_id === user.id;
  if (!song) return null;

  return (
    <div>
      {showPrompt && (
        <div className="mb-4 max-w-md">
          <LoginPromptInline action="mengubah lagu ini" onDismiss={() => setShowPrompt(false)} />
        </div>
      )}

      <SongDetailView
        song={song}
        back={
          <Link
            to="/project"
            aria-label="Kembali ke daftar lagu"
            className="inline-flex items-center text-sm text-stone-500 hover:text-stone-700"
          >
            <ArrowLeft className="size-4 sm:hidden" aria-hidden="true" />
            <span className="max-sm:hidden">← Semua lagu</span>
          </Link>
        }
        // Read-only untuk: lagu milik user lain (FR-VIS), template bagi non-admin
        // (FR-SONG-08); admin boleh edit template (FR-ROLE).
        readOnly={song.is_system_template ? !isAdmin : !isOwner}
        onEditAttempt={() => setShowPrompt(true)}
        onChanged={() => songQuery.refetch()}
      />
    </div>
  );
}
