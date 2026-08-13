import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { LoginForm } from '../features/auth/components/LoginForm'

export const Route = createFileRoute('/login')({ component: Login })

/** Layar 0b wireframe — auth disederhanakan; fokus form login + pintu Guest. */
function Login() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/dashboard' })
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="flex min-h-screen flex-col justify-center bg-stone-100 px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="text-center text-2xl/9 font-bold tracking-tight text-stone-900">
          Masuk ke BandJari
        </h2>
        <p className="mt-2 text-center text-sm text-stone-500">
          Prasyarat sebelum membuat & mengedit Song sendiri.
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <LoginForm onSuccess={() => navigate({ to: '/dashboard' })} />

        <p className="mt-10 text-center text-sm/6 text-stone-500">
          Belum punya akun?{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-600">
            Daftar
          </Link>
          {' · '}
          <Link to="/" className="font-semibold text-brand-700 hover:text-brand-600">
            ← Lihat Song Bawaan tanpa login
          </Link>
        </p>
      </div>
    </div>
  )
}
