import { createFileRoute, Link } from '@tanstack/react-router'
import { useGetSongsId } from '../../../api/endpoints/songs/songs'
import { SectionStrip, type SectionItem } from '../../../features/section/components/SectionStrip'

export const Route = createFileRoute('/_authenticated/songs/$songId')({
  component: SongDetailPage,
})

interface SongDetail {
  id: number;
  name: string;
  bpm: number;
  sections?: SectionItem[];
}

function SongDetailPage() {
  const { songId } = Route.useParams()
  const id = Number(songId)
  const songQuery = useGetSongsId(id)

  if (songQuery.isLoading) {
    return <p className="text-sm text-gray-500">Memuat detail lagu...</p>;
  }

  if (songQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-800">Lagu tidak ditemukan atau tidak dapat diakses.</p>
        <Link to="/songs" className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          Kembali ke daftar lagu
        </Link>
      </div>
    );
  }

  const resp = songQuery.data?.data;
  const song =
    resp && 'data' in resp && resp.status === 200 ? (resp.data as SongDetail) : undefined;
  if (!song) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/songs"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Semua lagu
          </Link>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{song.name}</h2>
          <p className="mt-1 text-sm text-gray-500">BPM dasar: {song.bpm}</p>
        </div>
      </div>

      <SectionStrip
        songId={id}
        songBpm={song.bpm}
        sections={song.sections ?? []}
        onChanged={() => songQuery.refetch()}
      />
    </div>
  );
}
