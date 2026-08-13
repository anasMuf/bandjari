import { createFileRoute } from '@tanstack/react-router'
import { useGetSongsId } from '../api/endpoints/songs/songs'
import { SequencerView } from '../features/sequencer/components/SequencerView'
import type { SectionItem } from '../features/section/components/SectionStrip'

export const Route = createFileRoute('/songs/$songId/sections/$sectionId')({
  component: SectionSequencerPage,
})

/**
 * Sequencer Mode (layar 3 wireframe) — dapat diakses Guest untuk Song Template
 * System (read-only, AC-11/12) dan pemilik Song untuk mengedit.
 */
function SectionSequencerPage() {
  const { songId, sectionId } = Route.useParams()
  const id = Number(songId)
  const sid = Number(sectionId)
  const songQuery = useGetSongsId(id)

  const data = songQuery.data?.data;
  const song =
    data && 'data' in data
      ? (data.data as {
          name: string;
          bpm?: number;
          is_system_template?: boolean;
          sections?: SectionItem[];
        })
      : undefined;
  const section = song?.sections?.find((s) => s.id === sid);
  const sectionName = section?.name ?? 'Section';
  // BPM efektif section: override (FR-SEC-08/09) atau ikut BPM dasar Song (AC-9).
  const songBpm = song?.bpm ?? 90;
  const bpmOverride = section?.bpm_override ?? null;

  return (
    <SequencerView
      key={sid}
      songId={id}
      sectionId={sid}
      sectionName={sectionName}
      songBpm={songBpm}
      bpmOverride={bpmOverride}
    />
  );
}
