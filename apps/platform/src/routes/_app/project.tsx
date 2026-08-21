import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '../../features/auth/AuthContext'
import { EmptyState } from '../../components/molecules/EmptyState'
import { MobilePageHeader } from '../../components/molecules/MobilePageHeader'
import { PageHeader } from '../../components/molecules/PageHeader'
import { seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/project')({
  head: ({ match }) =>
    seoMeta({
      title: 'Project | BandJari',
      description: 'Kelola lagu, section, dan library sample BandJari Anda.',
      pathname: match.pathname,
      noindex: true,
    }),
  component: ProjectLayout,
})

const tabBase =
  '-mb-px inline-flex items-center border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700'
const tabActive = 'border-brand-700 font-semibold text-brand-800'

/**
 * Project (menu 3): karya & aset milik user — tab "Lagu" (daftar song sendiri)
 * dan tab "Sample" (library sample). Guest melihat prompt login (FR-AUTH-07).
 */
function ProjectLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  return (
    <div>
      <MobilePageHeader title="Project" />

      <div className="max-sm:hidden">
        <PageHeader
          title="Project"
          subtitle="Karya & aset milikmu — lagu beserta Section dan pola pukulan, plus library sample."
        />
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-stone-500">Memuat...</p>
      ) : !isAuthenticated ? (
        <EmptyState
          icon="🔒"
          title="Login untuk membuka Project"
          description="Project berisi lagu & sample milikmu — buat, susun, edit, dan mainkan."
        >
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600"
          >
            Masuk
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-stone-900 ring-1 ring-stone-300 ring-inset transition-colors hover:bg-stone-50"
          >
            Daftar
          </Link>
        </EmptyState>
      ) : (
        <>
          <nav aria-label="Tab Project" className="mt-4 flex gap-1 border-b border-stone-200">
            <Link
              to="/project"
              className={tabBase}
              activeProps={{ className: tabActive }}
              activeOptions={{ exact: true }}
            >
              Lagu
            </Link>
            <Link
              to="/project/samples"
              className={tabBase}
              activeProps={{ className: tabActive }}
              activeOptions={{ exact: true }}
            >
              Sample
            </Link>
          </nav>
          <Outlet />
        </>
      )}
    </div>
  )
}
