import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError, customInstance } from '../api/mutator/custom-instance'
import { Button } from '../components/atoms/Button'
import { FormField } from '../components/molecules/FormField'
import { seoMeta } from '../lib/seo'

export const Route = createFileRoute('/forgot-password')({
  head: ({ match }) =>
    seoMeta({
      title: 'Lupa Password | BandJari',
      description: 'Minta link reset password akun BandJari Anda.',
      pathname: match.pathname,
      noindex: true,
    }),
  component: ForgotPassword,
})

/** Form minta link reset password (anti-enumeration: respons selalu sama). */
function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      await customInstance('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
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
          Lupa Password
        </h2>
        <p className="mt-2 text-center text-sm text-stone-500">
          Masukkan email — kami kirim link untuk memilih password baru.
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {done ? (
          <div>
            <p className="rounded-md bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              Bila email terdaftar, link reset password telah dikirim. Cek inbox Anda.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block font-semibold text-brand-700 hover:text-brand-600"
            >
              ← Kembali ke Masuk
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
              id="email"
              name="email"
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {message && <p className="text-sm text-red-700">{message}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Mengirim...' : 'Kirim link reset'}
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
