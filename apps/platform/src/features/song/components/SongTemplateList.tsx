import { Link } from '@tanstack/react-router';
import { useGetSongsTemplates } from '../../../api/endpoints/songs/songs';
import type { DtoSuccessResponse } from '../../../api/model';
import { Badge } from '../../../components/atoms/Badge';
import { SectionHeader } from '../../../components/molecules/SectionHeader';
import { EmptyState } from '../../../components/molecules/EmptyState';

interface TemplateSong {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
  section_count?: number;
}

/**
 * Daftar Song Template System di Beranda — entry point Guest (Flow 5.0, AC-11):
 * tanpa login, pengunjung langsung disuguhi lagu bawaan yang siap dimainkan.
 */
export function SongTemplateList() {
  const templatesQuery = useGetSongsTemplates();

  const templates = ((templatesQuery.data?.data as DtoSuccessResponse | undefined)?.data ??
    []) as TemplateSong[];

  if (templatesQuery.isLoading) {
    return <p className="mt-6 text-sm text-stone-500">Memuat lagu bawaan...</p>;
  }

  return (
    <section aria-label="Lagu bawaan" className="mt-6 sm:mt-10">
      <SectionHeader
        title="Lagu Bawaan"
        subtitle="Susunan standar Al-Banjari — bebas dimainkan tanpa login"
      />

      {templates.length === 0 ? (
        <EmptyState
          icon="♪"
          title="Belum ada lagu bawaan"
          description="Tim platform sedang menyiapkan susunan standar. Kembali lagi nanti."
        />
      ) : (
        <ul className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-lg bg-white ring-1 ring-stone-900/5">
          {templates.map((song) => (
            <li key={song.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <Link
                to="/templates/$songId"
                params={{ songId: String(song.id) }}
                className="min-w-0 flex-1 rounded-md -m-1 p-1 transition-colors hover:bg-stone-50"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-stone-900">{song.name}</span>
                  <Badge>SYSTEM</Badge>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  BPM {song.bpm} · {song.section_count ?? 0} Section · Song Template System —
                  siap dimainkan
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
