import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '../features/auth/AuthContext'
import { SongTemplateList } from '../features/song/components/SongTemplateList'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold text-gray-900">BandJari</h1>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/songs"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Lagu Saya →
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  Masuk
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Bermain musik selayaknya sebuah band, cukup dengan jari.
          </h2>
          <p className="mt-3 text-sm text-gray-600">
            BandJari menghadirkan pola pukulan rebana Al-Banjari secara digital — susun section,
            isi rumus pukulan per instrumen, dan mainkan secara live. Coba lagu bawaan di bawah
            tanpa perlu mendaftar.
          </p>
        </div>

        <SongTemplateList />
      </main>
    </div>
  );
}
