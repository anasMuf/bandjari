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
import { EditNameForm } from './EditNameForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import { SetPasswordForm } from './SetPasswordForm';
import { ConnectedAccountsCard } from './ConnectedAccountsCard';
import { SessionsCard } from './SessionsCard';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { useResendCooldown } from '../useResendCooldown';
import { ApiError, customInstance } from '../../../api/mutator/custom-instance';
import { useToast } from '../../../components/molecules/Toast';

/** Panel kartu section — header + konten, konsisten antar bagian. */
function Section({ title, children, danger = false }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className="mt-6 overflow-hidden rounded-lg bg-white ring-1 ring-stone-900/5">
      <div className={`border-b px-5 py-4 ${danger ? 'border-red-100' : 'border-stone-100'}`}>
        <h3 className={`text-base font-semibold ${danger ? 'text-red-800' : 'text-stone-900'}`}>{title}</h3>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

/**
 * Halaman Profile (menu 4) — pengelolaan akun 5 bagian (E-PROFILE-2026 R15):
 * identitas + status verifikasi, edit nama, keamanan (password + akun
 * terhubung), sesi aktif, dan zona berbahaya (hapus akun). Guest melihat
 * prompt login (FR-AUTH-07 — bukan redirect paksa).
 */
export function ProfileView() {
  const { isAuthenticated, isLoading, user, isAdmin, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);
  const { remaining, active, start } = useResendCooldown(false);

  const handleLogout = () => {
    setConfirming(false);
    logout();
    navigate({ to: '/' });
  };

  const resendVerification = async () => {
    start(); // restart cooldown 60s
    setResending(true);
    try {
      await customInstance('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: user?.email }),
      });
      addToast({ variant: 'success', title: 'Link dikirim', message: 'Cek email Anda (termasuk folder spam).' });
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Gagal mengirim ulang',
        message: error instanceof ApiError ? error.message : 'Terjadi kesalahan. Silakan coba lagi.',
      });
    } finally {
      setResending(false);
    }
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
  const emailVerified = !!user?.email_verified;
  const hasPassword = !!user?.has_password;

  return (
    <div>
      <MobilePageHeader title="Profile" />
      <div className="max-sm:hidden">
        <PageHeader title="Profile" subtitle="Profil akun, pengaturan, dan sesi masuk." />
      </div>

      {/* 1. Identitas */}
      <section className="mt-6 overflow-hidden rounded-lg bg-white ring-1 ring-stone-900/5">
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
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {isAdmin && <Badge variant="system">Admin</Badge>}
                {emailVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-600/20 ring-inset">
                    <span aria-hidden="true">✓</span> Email terverifikasi
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-600/20 ring-inset">
                    <span aria-hidden="true">!</span> Email belum diverifikasi
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {!emailVerified && (
          <div className="border-b border-stone-100 bg-stone-50 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-stone-600">Verifikasi email agar akun lebih aman.</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={resending || active}
                onClick={() => void resendVerification()}
              >
                {active ? `Kirim ulang (${remaining}s)` : resending ? 'Mengirim...' : 'Kirim ulang link'}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* 2. Edit Profil */}
      <Section title="Edit Profil">
        <EditNameForm />
      </Section>

      {/* 3. Keamanan */}
      <Section title="Keamanan">
        <div className="space-y-6">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-stone-900">
              {hasPassword ? 'Ganti password' : 'Buat password'}
            </h4>
            {hasPassword ? <ChangePasswordForm /> : <SetPasswordForm />}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-stone-900">Akun terhubung</h4>
            <ConnectedAccountsCard />
          </div>
        </div>
      </Section>

      {/* 4. Sesi Aktif */}
      <Section title="Sesi Aktif">
        <SessionsCard />
      </Section>

      {/* 5. Zona Berbahaya */}
      <Section title="Zona Berbahaya" danger>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-stone-700">Hapus akun BandJari Anda</p>
            <p className="mt-0.5 text-xs text-stone-500">
              Seluruh data (lagu, pola, sampel) ikut dihapus dan tidak dapat dipulihkan.
            </p>
          </div>
          <DeleteAccountDialog />
        </div>
      </Section>

      {/* Logout — tetap tersedia terpisah dari zona berbahaya. */}
      <div className="mt-6">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => setConfirming(true)}
        >
          Logout
        </Button>
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
