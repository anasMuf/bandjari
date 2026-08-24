import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { ApiError, customInstance } from '../../../api/mutator/custom-instance';
import { Button } from '../../../components/atoms/Button';
import { useResendCooldown } from '../useResendCooldown';

/**
 * Banner "verifikasi email" — muncul saat user login tapi email belum
 * diverifikasi (E-AUTH-2026 R9, keputusan Q3: tetap bisa pakai aplikasi).
 * Tombol "Kirim ulang" memanggil POST /auth/resend-verification.
 */
export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { remaining, active, start } = useResendCooldown(false);

  if (!user || user.email_verified) {
    return null;
  }

  const resend = async () => {
    start(); // restart cooldown 60s
    setSending(true);
    setMessage(null);
    try {
      await customInstance('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      });
      setMessage('Link verifikasi baru telah dikirim — cek email Anda.');
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'Gagal mengirim ulang — coba beberapa saat lagi.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3"
    >
      <p className="text-sm font-medium text-amber-900">
        Verifikasi email Anda
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Cek inbox untuk link verifikasi. Fitur Anda tidak terbatas tanpa
        verifikasi, tapi akun lebih aman setelah email dikonfirmasi.
      </p>
      <div className="mt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={sending || active}
          onClick={() => void resend()}
        >
          {active ? `Kirim ulang (${remaining}s)` : sending ? 'Mengirim...' : 'Kirim ulang link'}
        </Button>
        {message && <p className="mt-1 text-xs text-amber-900">{message}</p>}
      </div>
    </div>
  );
}
