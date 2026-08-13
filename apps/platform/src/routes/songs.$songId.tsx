import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/songs/$songId')({
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
