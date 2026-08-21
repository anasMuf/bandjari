import { createFileRoute } from '@tanstack/react-router'
import { SongListView } from '../../features/song/components/SongListView'
import { seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/project/')({
  head: ({ match }) =>
    seoMeta({
      title: 'Lagu Saya | BandJari',
      description: 'Daftar lagu pola rebana Al-Banjari milik Anda.',
      pathname: match.pathname,
      noindex: true,
    }),
  component: SongListView,
})
