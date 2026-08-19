import { createFileRoute } from '@tanstack/react-router'
import { MobilePageHeader } from '../../components/molecules/MobilePageHeader'
import { PageHeader } from '../../components/molecules/PageHeader'
import { SongTemplateList } from '../../features/song/components/SongTemplateList'

export const Route = createFileRoute('/_app/explore')({
  component: ExplorePage,
})

/**
 * Explore (menu 2): daftar lagu bawaan sistem — bebas dimainkan tanpa login.
 * Ke depannya juga menampilkan lagu publik dari akun lain (mirip FYP).
 */
function ExplorePage() {
  return (
    <div>
      <MobilePageHeader title="Explore" />

      <div className="max-sm:hidden">
        <PageHeader
          title="Explore"
          subtitle="Lagu bawaan sistem — bebas dimainkan tanpa login. Ke depannya juga menampilkan lagu publik dari akun lain."
        />
      </div>

      <SongTemplateList />
    </div>
  )
}
