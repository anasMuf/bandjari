import { createFileRoute } from '@tanstack/react-router'
import { SongPublicView } from '../features/song/components/SongPublicView'
import { seoMeta } from '../lib/seo'

export const Route = createFileRoute('/songs/public/$songId')({
  head: ({ match }) =>
    seoMeta({
      title: 'Lagu Publik Pola Rebana Al-Banjari | BandJari',
      description:
        'Lihat pola pukulan rebana Al-Banjari publik dari komunitas — bebas dimainkan tanpa login, duplikasi untuk menyusun pola sendiri.',
      pathname: match.pathname,
    }),
  component: PublicSongViewPage,
})

/**
 * Viewer publik untuk lagu ber-status public (FR-VIS): banner Mode Lihat Saja
 * dengan atribusi author, strip section read-only, dan duplikasi ke "Lagu Saya"
 * bagi pengguna login. Akses lintas-user dimungkinkan karena visibility=public —
 * sama seperti Song Template System, tapi dengan nama penulis.
 */
function PublicSongViewPage() {
  const { songId } = Route.useParams()
  return <SongPublicView songId={Number(songId)} />
}
