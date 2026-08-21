import { createFileRoute, Outlet } from '@tanstack/react-router'
import { seoMeta } from '../lib/seo'

export const Route = createFileRoute('/songs/$songId')({
  head: ({ match }) =>
    seoMeta({
      title: 'Lagu | BandJari',
      description: 'Kelola lagu pola rebana Al-Banjari Anda.',
      pathname: match.pathname,
      noindex: true,
    }),
  component: SongLayout,
})

/**
 * Layout bersama untuk halaman-halaman di bawah /songs/:songId
 * (kelola/index, play, sections) — konten anak dirender via <Outlet />.
 */
function SongLayout() {
  return (
    <div className="min-h-screen bg-stone-100">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
