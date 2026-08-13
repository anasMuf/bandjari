import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../features/auth/AuthContext'
import { SongTemplateList } from '../features/song/components/SongTemplateList'
import { TopBar } from '../components/molecules/TopBar'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

/**
 * Beranda (layar 0 wireframe) — entry point Guest (Flow 5.0): pengunjung tanpa
 * login langsung disuguhi Song Template System yang siap dimainkan (AC-11).
 * Login baru diperlukan untuk membuat/mengedit karya sendiri.
 */
function LandingPage() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: '/' });
  };

  return (
    <div className="min-h-screen bg-stone-100">
      <TopBar
        variant={isAuthenticated ? 'app' : 'guest'}
        userName={user?.name}
        onLogout={isAuthenticated ? handleLogout : undefined}
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">
            Selamat Datang di BandJari
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            Bermain musik selayaknya sebuah band, cukup dengan jari — susun section, isi pola
            pukulan rebana Al-Banjari per instrumen, dan mainkan secara live.
          </p>
          <p className="mt-4 rounded-md border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600">
            <span className="font-semibold text-stone-800">Tanpa perlu login</span> — langsung
            mainkan Song bawaan (Template System) di bawah. Login baru diperlukan saat mau
            membuat atau mengedit karya sendiri.
          </p>
        </div>

        <SongTemplateList />

        <div className="mt-10 rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">Mau susun lagu sendiri?</h2>
          <p className="mt-1 text-sm text-stone-600">
            {isAuthenticated
              ? 'Lanjutkan ke Lagu Saya untuk membuat Song baru, menambah Section, dan mengedit pola pukulan.'
              : 'Login atau daftar untuk membuat Song sendiri, menambah Section, mengedit pola pukulan, dan mengunggah sample audio milikmu.'}
          </p>
          <div className="mt-4">
            {isAuthenticated ? (
              <Link
                to="/songs"
                className="inline-flex items-center justify-center rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600"
              >
                Buka Lagu Saya →
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600"
              >
                Login / Daftar
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
