import { useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router'
import { useGetSongsId } from '../../../api/endpoints/songs/songs'
import { useAuth } from '../../../features/auth/AuthContext'
import { LauncherGrid } from '../../../features/launcher/components/LauncherGrid'
import {
  useLauncherPlayback,
  type LauncherSection,
} from '../../../features/launcher/hooks/useLauncherPlayback'

export const Route = createFileRoute('/songs/$songId/play')({
  component: LauncherPage,
})

interface SongDetail {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
  sections?: LauncherSection[];
}

/**
 * Launcher Mode — mode pemutaran live (clip launcher). Dapat diakses Guest
 * untuk Song Template System (AC-11) dan pemilik Song.
 */
function LauncherPage() {
  const { songId } = Route.useParams()
  const id = Number(songId)
  const songQuery = useGetSongsId(id)
  const { isAuthenticated } = useAuth()
  const resp = songQuery.data?.data;
  const song =
    resp && 'data' in resp && resp.status === 200 ? (resp.data as SongDetail) : undefined;

  const playback = useLauncherPlayback(song?.bpm ?? 90);

  useEffect(() => {
    if (song && song.sections && !playback.ready) {
      void playback.prepare(song.sections);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, playback.ready]);

  if (songQuery.isLoading) {
    return <p className="p-6 text-sm text-gray-500">Memuat lagu...</p>;
  }

  if (songQuery.isError || !song) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {isAuthenticated && song && !song.is_system_template ? (
              <Link
                to="/songs/$songId"
                params={{ songId: String(id) }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Kelola lagu
              </Link>
            ) : (
              <Link
                to="/templates/$songId"
                params={{ songId: String(id) }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Kembali ke lagu
              </Link>
            )}
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{song.name}</h2>
            <p className="mt-1 text-sm text-gray-500">Launcher Mode · {song.bpm} BPM dasar</p>
          </div>
        </div>

        {playback.error ? (
          <div role="status" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-medium text-red-800">{playback.error}</p>
          </div>
        ) : !playback.ready ? (
          <p className="mt-6 text-sm text-gray-500" aria-busy="true">
            Menyiapkan audio (memuat & mendekode sample)…
          </p>
        ) : (
          <LauncherGrid
            sections={song.sections ?? []}
            activeSectionId={playback.activeSectionId}
            pendingSectionId={playback.pendingSectionId}
            stepIndex={playback.stepIndex}
            isPlaying={playback.isPlaying}
            onTrigger={playback.trigger}
            onStop={playback.stop}
          />
        )}
      </main>
    </div>
  );
}
