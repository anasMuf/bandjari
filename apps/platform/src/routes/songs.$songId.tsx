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
    <div className="min-h-screen bg-gray-50">
      <Outlet />
    </div>
  );
}
