import { createFileRoute } from '@tanstack/react-router'
import { SongListView } from '../../features/song/components/SongListView'

export const Route = createFileRoute('/_authenticated/songs')({
  component: SongsPage,
})

function SongsPage() {
  return <SongListView />
}
