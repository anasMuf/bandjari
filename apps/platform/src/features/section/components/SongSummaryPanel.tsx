import { Link } from '@tanstack/react-router';

interface SummarySection {
  id: number;
  bpm_override: number | null;
  parts?: Array<{ sound_slots?: Array<{ sample_id: number | null }> }>;
}

interface SongSummaryPanelProps {
  songId: number;
  sections: SummarySection[];
}

/**
 * Panel "Ringkasan Song" (layar 2 wireframe): jumlah section, jumlah override,
 * kelengkapan sample per section, dan pintu ke Launcher Mode.
 */
export function SongSummaryPanel({ songId, sections }: SongSummaryPanelProps) {
  const overrideCount = sections.filter((s) => s.bpm_override !== null).length;

  // Section dianggap "lengkap" bila seluruh bagian instrumennya punya minimal
  // satu jenis bunyi dengan sample terpasang (sisanya senyap saat dimainkan).
  const completeCount = sections.filter((s) => {
    const parts = s.parts ?? [];
    return parts.length > 0 && parts.every((p) => (p.sound_slots ?? []).some((slot) => slot.sample_id != null));
  }).length;

  return (
    <div className="rounded-lg bg-white p-5 ring-1 ring-stone-900/5">
      <h2 className="text-base font-semibold text-stone-900">Ringkasan Song</h2>
      <ul className="mt-3 space-y-1.5 text-sm text-stone-600">
        <li>{sections.length} Section tersusun</li>
        <li>{overrideCount} Section punya tempo berbeda (BPM override)</li>
        <li>
          Kelengkapan sample: {completeCount}/{sections.length} Section sudah punya sample lengkap
        </li>
      </ul>
      <Link
        to="/songs/$songId/play"
        params={{ songId: String(songId) }}
        className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600"
      >
        ▶ Buka Launcher Mode
      </Link>
    </div>
  );
}
