import { createFileRoute } from '@tanstack/react-router'
import { SongPublicView } from '../features/song/components/SongPublicView'
import { seoMeta } from '../lib/seo'

export const Route = createFileRoute('/templates/$songId')({
  head: ({ match }) =>
    seoMeta({
      title: 'Template Pola Rebana Al-Banjari | BandJari',
      description:
        'Lihat pola pukulan rebana Al-Banjari lengkap per section — 4 rebana + 1 bass. Bebas dimainkan tanpa login, duplikasi untuk menyusun pola sendiri.',
      pathname: match.pathname,
    }),
  component: TemplateViewPage,
})

/**
 * Viewer publik Song Template System (AC-11, layar 2 wireframe): mode lihat-saja
 * (banner Mode Admin untuk admin yang mengelola template), strip section
 * read-only, dan duplikasi ke "Lagu Saya" bagi pengguna login.
 */
function TemplateViewPage() {
  const { songId } = Route.useParams()
  return <SongPublicView songId={Number(songId)} authorLabel="Tim BandJari" adminCanEdit />
}
