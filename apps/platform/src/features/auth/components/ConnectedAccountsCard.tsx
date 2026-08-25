import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../components/molecules/Toast';
import { useAuth } from '../AuthContext';
import { GoogleLoginButton } from './GoogleLoginButton';
import { getGetUsersQueryKey } from '../../../api/endpoints/auth/auth';
import { ApiError, customInstance } from '../../../api/mutator/custom-instance';

/**
 * Bagian 3b — Akun Terhubung: status provider OAuth (Google) + tombol
 * Link/Unlink (E-PROFILE-2026 R3/R4). Akun Google-only (tanpa password) tidak
 * boleh unlink — backend menolak (ErrLastLoginMethod); UI menuntun ke
 * set-password dulu.
 */
export function ConnectedAccountsCard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [unlinking, setUnlinking] = useState(false);

  const googleLinked = (user?.providers ?? []).includes('google');
  const hasPassword = !!user?.has_password;

  const unlinkGoogle = async () => {
    setUnlinking(true);
    try {
      await customInstance('/auth/providers/google', { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
      addToast({ variant: 'success', title: 'Google diputuskan', message: 'Koneksi Google berhasil dilepas.' });
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Gagal memutuskan Google',
        message: error instanceof ApiError ? error.message : 'Terjadi kesalahan. Silakan coba lagi.',
      });
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-900">Google</p>
          <p className="mt-0.5 text-xs text-stone-500">
            {googleLinked ? 'Terhubung — bisa masuk dengan Google.' : 'Belum terhubung.'}
          </p>
        </div>
        {googleLinked ? (
          hasPassword ? (
            <button
              type="button"
              onClick={() => void unlinkGoogle()}
              disabled={unlinking}
              className="shrink-0 cursor-pointer text-sm font-semibold text-red-700 hover:text-red-600 disabled:opacity-50"
            >
              {unlinking ? 'Memutus...' : 'Putuskan koneksi'}
            </button>
          ) : (
            <span className="shrink-0 text-xs text-stone-400" title="Buat password dulu untuk bisa memutuskan Google">
              Butuh password
            </span>
          )
        ) : (
          <GoogleLoginButton label="Hubungkan" link className="w-auto" />
        )}
      </div>
      {!hasPassword && googleLinked && (
        <p className="text-xs text-stone-500">
          Buat password di bagian atas untuk bisa memutuskan koneksi Google (akun
          tidak boleh tanpa metode login sama sekali).
        </p>
      )}
    </div>
  );
}
