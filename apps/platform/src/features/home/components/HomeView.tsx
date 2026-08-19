import { Link } from '@tanstack/react-router';
import { Compass, FolderKanban } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useGetSongs } from '../../../api/endpoints/songs/songs';
import { useGetSamples } from '../../../api/endpoints/samples/samples';
import type { DtoSuccessResponse } from '../../../api/model';
import { MobilePageHeader } from '../../../components/molecules/MobilePageHeader';

interface SongSummary {
  id: number;
  section_count?: number;
}

interface SampleSummary {
  id: number;
}

/**
 * Halaman Home (menu 1): sapaan + ringkasan statistik karya user (lagu, section,
 * sample) + kartu pintasan ke Explore & Project. Guest melihat sapaan umum tanpa
 * statistik — query hanya aktif saat login (menghindari 401).
 */
export function HomeView() {
  const { isAuthenticated, user } = useAuth();
  const songsQuery = useGetSongs({ query: { enabled: isAuthenticated } });
  const samplesQuery = useGetSamples(undefined, { query: { enabled: isAuthenticated } });

  const songs = ((songsQuery.data?.data as DtoSuccessResponse | undefined)?.data ?? []) as SongSummary[];
  const samples = ((samplesQuery.data?.data as DtoSuccessResponse | undefined)?.data ?? []) as SampleSummary[];
  const sectionCount = songs.reduce((sum, song) => sum + (song.section_count ?? 0), 0);

  const stats = [
    { label: 'Lagu', value: songs.length },
    { label: 'Section', value: sectionCount },
    { label: 'Sample', value: samples.length },
  ];

  return (
    <div>
      <MobilePageHeader userName={user?.name ?? null} />

      <header className="max-sm:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          Selamat Datang{user?.name ? `, ${user.name}` : ' di BandJari'}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Bermain musik selayaknya sebuah band, cukup dengan jari — susun Section, isi pola
          pukulan rebana Al-Banjari per instrumen, dan mainkan secara live.
        </p>
      </header>

      {isAuthenticated ? (
        <dl className="mt-6 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg bg-white p-4 text-center ring-1 ring-stone-900/5"
            >
              <dd className="text-2xl font-bold text-stone-900">{stat.value}</dd>
              <dt className="mt-1 text-xs text-stone-500">{stat.label}</dt>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-6 rounded-md border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600">
          <span className="font-semibold text-stone-800">Tanpa perlu login</span> — jelajahi
          Lagu Bawaan di Explore dan mainkan langsung. Login baru diperlukan saat mau membuat
          atau mengedit karya sendiri.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/explore"
          className="rounded-lg bg-white p-5 ring-1 ring-stone-900/5 transition-colors hover:ring-brand-700/40"
        >
          <span className="flex items-center gap-2 text-base font-semibold text-stone-900">
            <Compass className="size-5 text-brand-700" aria-hidden="true" />
            Explore
          </span>
          <p className="mt-1 text-sm text-stone-500">
            Lagu bawaan sistem — bebas dimainkan tanpa login.
          </p>
        </Link>
        <Link
          to="/project"
          className="rounded-lg bg-white p-5 ring-1 ring-stone-900/5 transition-colors hover:ring-brand-700/40"
        >
          <span className="flex items-center gap-2 text-base font-semibold text-stone-900">
            <FolderKanban className="size-5 text-brand-700" aria-hidden="true" />
            Project
          </span>
          <p className="mt-1 text-sm text-stone-500">
            Lagu & sample milikmu — susun, edit, dan mainkan.
          </p>
        </Link>
      </div>
    </div>
  );
}
