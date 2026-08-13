import { createFileRoute, Link } from '@tanstack/react-router'
import { useGetSongsId } from '../../../../../api/endpoints/songs/songs'
import { SequencerView } from '../../../../../features/sequencer/components/SequencerView'
import type { SectionItem } from '../../../../../features/section/components/SectionStrip'

export const Route = createFileRoute('/_authenticated/songs/$songId/sections/$sectionId')({
  component: SectionSequencerPage,
})

function SectionSequencerPage() {
  const { songId, sectionId } = Route.useParams()
  const id = Number(songId)
  const sid = Number(sectionId)
  const songQuery = useGetSongsId(id)

  const data = songQuery.data?.data;
  const song =
    data && 'data' in data && data.status === 200
      ? (data.data as { name: string; sections?: SectionItem[] })
      : undefined;
  const sectionName = song?.sections?.find((s) => s.id === sid)?.name ?? 'Section';

  return (
    <div>
      <Link
        to="/songs/$songId"
        params={{ songId: String(id) }}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← Kembali ke lagu
      </Link>
      <div className="mt-4">
        <SequencerView songId={id} sectionId={sid} sectionName={sectionName} />
      </div>
    </div>
  );
}
