import { createFileRoute, Link, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError, customInstance } from '../api/mutator/custom-instance'
import { Button } from '../components/atoms/Button'
import { FormField } from '../components/molecules/FormField'
import { seoMeta } from '../lib/seo'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : '',
  }),
  head: ({ match }) =>
    seoMeta({
      title: 'Reset Password | BandJari',
      description: 'Pilih password baru untuk akun BandJari Anda.',
      pathname: match.pathname,
      noindex: true,
    }),
  component: ResetPassword,
})

/** Halaman yang dituju link reset dari email ({APP_BASE_URL}/reset-password?code=...). */
function ResetPassword() {
  const { code } = useSearch({ from: '/reset-password' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage('Konfirmasi password tidak sama.');
      return;
    }
    if (password.length < 8) {
      setMessage('Password minimal 8 karakter.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      await customInstance('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ code, password }),
      });
      setDone(true);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'Terjadi kesalahan. Silakan coba lagi.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-stone-100 px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="text-center text-2xl/9 font-bold tracking-tight text-stone-900">
          Reset Password
        </h2>
        <p className="mt-2 text-center text-sm text-stone-500">
          Pilih password baru (minimal 8 karakter).
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {done ? (
          <div>
            <p className="rounded-md bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              Password berhasil diubah! Silakan masuk dengan password baru.
            </p>
            <Link to="/login">
              <Button type="button" className="mt-4 w-full">
                Masuk
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
              id="password"
              name="password"
              type="password"
              label="Password baru"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <FormField
              id="confirm"
              name="confirm"
              type="password"
              label="Ulangi password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
            {message && <p className="text-sm text-red-700">{message}</p>}
            <Button type="submit" className="w-full" disabled={submitting || !code}>
              {submitting ? 'Menyimpan...' : 'Simpan password baru'}
            </Button>
            <p className="text-center text-sm/6 text-stone-500">
              <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-600">
                ← Kembali ke Masuk
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
