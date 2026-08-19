import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppNav } from '../components/molecules/AppNav'
import { BottomNav } from '../components/molecules/BottomNav'

export const Route = createFileRoute('/_app')({
  component: AppShell,
})

/**
 * Shell aplikasi utama (4 menu): navbar atas di desktop, bottom navigation di
 * mobile. Halaman auth (login/register) dan sub-halaman lagu (detail/sequencer/
 * launcher) berada DI LUAR shell ini — mereka punya navigasi kembali sendiri.
 */
function AppShell() {
  return (
    <div className="min-h-screen bg-stone-100">
      <AppNav />

      {/* pb-24 = ruang untuk BottomNav mobile (tinggi + safe-area). */}
      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
