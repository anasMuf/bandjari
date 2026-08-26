import { Link } from '@tanstack/react-router';
import { useGetSongsPublic } from '../../../api/endpoints/songs/songs';
import type { DtoSuccessResponse } from '../../../api/model';
import { Badge } from '../../../components/atoms/Badge';
import { SectionHeader } from '../../../components/molecules/SectionHeader';
import { EmptyState } from '../../../components/molecules/EmptyState';

interface PublicSong {
  id: number;
  name: string;
  bpm: number;
  visibility: string;
  /** Nama pemilik lagu — dari relasi Author (FR-VIS). */
  author_name?: string;
  section_count?: number;
}

/**
 * Daftar lagu publik (milik user, status visibility=public) di Explore (FR-VIS).
 * Setiap lagu menampilkan nama author; nama lagu membuka viewer lihat-saja,
 * tombol ▶ Main langsung ke Launcher (Guest bisa memutar — audio ikut dibagikan).
 */
export function PublicSongList() {
  const publicQuery = useGetSongsPublic();

  const songs = ((publicQuery.data?.data as DtoSuccessResponse | undefined)?.data ?? []) as PublicSong[];

  if (publicQuery.isLoading) {
    return <p className="mt-6 text-sm text-stone-500">Memuat lagu publik...</p>;
  }

  return (
    <section aria-label="Lagu publik" className="mt-6 sm:mt-10">
      <SectionHeader
        title="Lagu Publik"
        subtitle="Lagu dari komunitas yang dipublikasikan — lengkap dengan nama penulisnya"
      />

      {songs.length === 0 ? (
        <EmptyState
          icon="♫"
          title="Belum ada lagu publik"
          description="Lagu publik akan tampil di sini beserta nama penulisnya saat admin memublikasikan karyanya."
        />
      ) : (
        <ul className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-lg bg-white ring-1 ring-stone-900/5">
          {songs.map((song) => (
            <li key={song.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <Link
                to="/songs/public/$songId"
                params={{ songId: String(song.id) }}
                className="min-w-0 flex-1 rounded-md -m-1 p-1 transition-colors hover:bg-stone-50"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-stone-900">{song.name}</span>
                  <Badge>PUBLIK</Badge>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  oleh <span className="font-medium text-stone-700">{song.author_name ?? '—'}</span>
                  {' · '}BPM {song.bpm} · {song.section_count ?? 0} Section
                </p>
              </Link>
              <Link
                to="/songs/$songId/play"
                params={{ songId: String(song.id) }}
                aria-label={`Mainkan ${song.name} di Launcher`}
                className="inline-flex items-center justify-center rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                ▶ Main
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
