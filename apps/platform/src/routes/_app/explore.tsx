import { createFileRoute } from '@tanstack/react-router'
import { MobilePageHeader } from '../../components/molecules/MobilePageHeader'
import { PageHeader } from '../../components/molecules/PageHeader'
import { SongTemplateList } from '../../features/song/components/SongTemplateList'
import { PublicSongList } from '../../features/song/components/PublicSongList'
import { seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/explore')({
  head: ({ match }) =>
    seoMeta({
      title: 'Explore Pola Rebana Al-Banjari | BandJari',
      description:
        'Jelajahi pola pukulan rebana Al-Banjari — lagu bawaan dan lagu publik dari komunitas, bebas dimainkan tanpa login. Duplikasi ke Lagu Saya, lalu susun pola 4 rebana + bass sendiri.',
      pathname: match.pathname,
    }),
  component: ExplorePage,
})

/**
 * Explore (menu 2): Lagu Bawaan (template sistem) + Lagu Publik dari komunitas
 * (visibility=public, FR-VIS) — keduanya bebas dimainkan tanpa login.
 */
function ExplorePage() {
  return (
    <div>
      <MobilePageHeader title="Explore" />

      <div className="max-sm:hidden">
        <PageHeader
          title="Explore"
          subtitle="Lagu bawaan sistem & lagu publik dari komunitas — bebas dimainkan tanpa login."
        />
      </div>

      <SongTemplateList />
      <PublicSongList />
    </div>
  )
}
