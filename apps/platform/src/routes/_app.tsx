import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppNav } from '../components/molecules/AppNav'
import { BottomNav } from '../components/molecules/BottomNav'
import { Footer } from '../components/molecules/Footer'

export const Route = createFileRoute('/_app')({
  component: AppShell,
})

/**
 * Shell aplikasi utama (4 menu): navbar atas di desktop, bottom navigation di
 * mobile, footer di desktop. Halaman auth (login/register) dan sub-halaman lagu
 * (detail/sequencer/launcher) berada DI LUAR shell ini — mereka punya navigasi
 * kembali sendiri.
 */
function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-100">
      <AppNav />

      {/* pb-24 = ruang untuk BottomNav mobile (tinggi + safe-area). */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </main>

      <BottomNav />
      <Footer />
    </div>
  )
}
