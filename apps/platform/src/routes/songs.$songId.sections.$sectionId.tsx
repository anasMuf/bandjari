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
      ? (data.data as { name: string; is_system_template?: boolean; sections?: SectionItem[] })
      : undefined;
  const sectionName = song?.sections?.find((s) => s.id === sid)?.name ?? 'Section';

  return <SequencerView key={sid} songId={id} sectionId={sid} sectionName={sectionName} />;
}
