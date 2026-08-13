import { createFileRoute, Link } from '@tanstack/react-router'
import { useGetSongsId } from '../api/endpoints/songs/songs'
import { useAuth } from '../features/auth/AuthContext'
import { SectionStrip, type SectionItem } from '../features/section/components/SectionStrip'

export const Route = createFileRoute('/songs/$songId/')({
  component: SongDetailPage,
})

interface SongDetail {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
  sections?: SectionItem[];
}

/**
 * Halaman kelola lagu milik user: SectionStrip untuk menambah/mengedit section
 * + tombol Launcher. Untuk Song Template, arahkan ke halaman template.
 */
function SongDetailPage() {
  const { songId } = Route.useParams()
  const id = Number(songId)
  const songQuery = useGetSongsId(id)
  const { isAuthenticated } = useAuth()

  if (songQuery.isLoading) {
    return <p className="p-6 text-sm text-gray-500">Memuat detail lagu...</p>;
  }

  if (songQuery.isError || !isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          {isAuthenticated ? (
            <>
              <p className="text-sm font-medium text-red-800">Lagu tidak ditemukan atau tidak dapat diakses.</p>
              <Link to="/songs" className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500">
                Kembali ke daftar lagu
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-red-800">Lagu ini milik pengguna lain.</p>
              <p className="mt-1 text-xs text-red-700">Masuk untuk mengelola lagu Anda.</p>
              <Link
                to="/login"
                className="mt-3 inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
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
  if (!song) return null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/songs" className="text-sm text-gray-500 hover:text-gray-700">
            ← Semua lagu
          </Link>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{song.name}</h2>
          <p className="mt-1 text-sm text-gray-500">BPM dasar: {song.bpm}</p>
        </div>
        <Link
          to="/songs/$songId/play"
          params={{ songId: String(id) }}
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-gray-700"
        >
          ▶ Mainkan (Launcher)
        </Link>
      </div>

      <SectionStrip
        songId={id}
        songBpm={song.bpm}
        sections={song.sections ?? []}
        onChanged={() => songQuery.refetch()}
      />
    </main>
  );
}
