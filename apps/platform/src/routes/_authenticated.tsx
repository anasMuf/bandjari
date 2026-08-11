import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { hasToken, useAuth } from '../features/auth/AuthContext'
import { Button } from '../components/atoms/Button'
import { ConfirmDialog } from '../components/molecules/ConfirmDialog'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    if (!hasToken()) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user, logout, isLoading, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/login' })
    }
  }, [isAuthenticated, isLoading, navigate])

  const handleLogout = useCallback(() => {
    setShowLogoutDialog(false)
    logout()
    navigate({ to: '/login' })
  }, [logout, navigate])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold text-gray-900">Starter Kit</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.full_name || 'User'}
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowLogoutDialog(true)}>
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        open={showLogoutDialog}
        title="Sign out"
        description="Are you sure you want to sign out? You will need to sign in again to access your dashboard."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutDialog(false)}
      />
    </div>
  )
}
