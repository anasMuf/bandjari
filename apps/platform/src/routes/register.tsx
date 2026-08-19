import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { RegisterForm } from '../features/auth/components/RegisterForm'

export const Route = createFileRoute('/register')({ component: Register })

function Register() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/' })
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="flex min-h-screen flex-col justify-center bg-stone-100 px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-2xl/9 font-bold tracking-tight text-stone-900">
          Buat Akun BandJari
        </h2>
        <p className="mt-2 text-center text-sm text-stone-500">
          Lengkapi data di bawah untuk mulai menyusun karya sendiri.
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <RegisterForm onSuccess={() => navigate({ to: '/login' })} />

        <p className="mt-10 text-center text-sm/6 text-stone-500">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-600">
            Masuk
          </Link>
          {' · '}
          <Link to="/explore" className="font-semibold text-brand-700 hover:text-brand-600">
            ← Lihat Song Bawaan tanpa login
          </Link>
        </p>
      </div>
    </div>
  )
}
