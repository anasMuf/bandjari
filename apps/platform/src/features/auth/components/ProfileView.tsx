import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../AuthContext';
import { Badge } from '../../../components/atoms/Badge';
import { Button } from '../../../components/atoms/Button';
import { ConfirmDialog } from '../../../components/molecules/ConfirmDialog';
import { EmptyState } from '../../../components/molecules/EmptyState';
import { MobilePageHeader } from '../../../components/molecules/MobilePageHeader';
import { PageHeader } from '../../../components/molecules/PageHeader';
import { SupportLinksSection } from '../../support/components/SupportLinksSection';

/**
 * Halaman Profile (menu 4): identitas akun (avatar generik, nama, email, role),
 * pintu pengaturan (segera hadir), dan logout dengan konfirmasi. Guest melihat
 * prompt login (FR-AUTH-07 — bukan redirect paksa).
 */
export function ProfileView() {
  const { isAuthenticated, isLoading, user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const handleLogout = () => {
    setConfirming(false);
    logout();
    navigate({ to: '/' });
  };

  if (isLoading) {
    return <p className="text-sm text-stone-500">Memuat profil...</p>;
  }

  if (!isAuthenticated) {
    return (
      <div>
        <MobilePageHeader title="Profile" />
        <EmptyState
          icon="🔒"
          title="Login untuk membuka Profile"
          description="Kelola profil, pengaturan, dan keluar dari akunmu."
        >
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600"
          >
            Masuk
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-stone-900 ring-1 ring-stone-300 ring-inset transition-colors hover:bg-stone-50"
          >
            Daftar
          </Link>
        </EmptyState>

        {/* Guest juga perlu akses support di mobile. */}
        <SupportLinksSection />
      </div>
    );
  }

  const initial = (user?.name?.trim().charAt(0) || 'B').toUpperCase();

  return (
    <div>
      <MobilePageHeader title="Profile" />
      <div className="max-sm:hidden">
        <PageHeader title="Profile" subtitle="Profil akun, pengaturan, dan sesi masuk." />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg bg-white ring-1 ring-stone-900/5">
        <div className="border-b border-stone-100 px-5 py-6">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xl font-bold text-white"
            >
              {initial}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-stone-900">{user?.name}</h2>
              <p className="mt-0.5 truncate text-sm text-stone-500">{user?.email}</p>
              {isAdmin && (
                <span className="mt-1.5 block">
                  <Badge>Admin</Badge>
                </span>
              )}
            </div>
          </div>
        </div>

        <ul className="divide-y divide-stone-100">
          <li className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-stone-600">Pengaturan</span>
            <span className="text-xs text-stone-400">Segera hadir</span>
          </li>
        </ul>

        <div className="border-t border-stone-100 px-5 py-4">
          <Button
            type="button"
            variant="danger"
            className="w-full sm:w-auto"
            onClick={() => setConfirming(true)}
          >
            Logout
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Sign out"
        description="Are you sure you want to sign out? You will need to sign in again to access your dashboard."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleLogout}
        onCancel={() => setConfirming(false)}
      />

      {/* Pintu akses halaman support — utama untuk mobile (keputusan desain #1). */}
      <SupportLinksSection />
    </div>
  );
}
