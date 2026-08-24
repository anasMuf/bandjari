import { createFileRoute, Link, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ApiError, customInstance } from '../api/mutator/custom-instance'
import { Button } from '../components/atoms/Button'
import { seoMeta } from '../lib/seo'

export const Route = createFileRoute('/verify')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : '',
  }),
  head: ({ match }) =>
    seoMeta({
      title: 'Verifikasi Email | BandJari',
      description: 'Verifikasi alamat email akun BandJari Anda.',
      pathname: match.pathname,
      noindex: true,
    }),
  component: Verify,
})

type VerifyState = 'loading' | 'success' | 'error' | 'missing';

/** Halaman yang dituju link verifikasi dari email ({APP_BASE_URL}/verify?code=...). */
function Verify() {
  const { code } = useSearch({ from: '/verify' });
  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!code) {
      setState('missing');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await customInstance('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        if (!cancelled) setState('success');
      } catch (error) {
        if (!cancelled) {
          setState('error');
          setMessage(
            error instanceof ApiError
              ? error.message
              : 'Terjadi kesalahan. Silakan coba lagi.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="flex min-h-screen flex-col justify-center bg-stone-100 px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="text-center text-2xl/9 font-bold tracking-tight text-stone-900">
          Verifikasi Email
        </h2>
        <p className="mt-2 text-center text-sm text-stone-500">
          Konfirmasi alamat email akun BandJari Anda.
        </p>
      </div>

      <div className="mt-10 text-center sm:mx-auto sm:w-full sm:max-w-sm">
        {state === 'loading' && (
          <p className="text-sm text-stone-500">Memproses verifikasi…</p>
        )}

        {state === 'missing' && (
          <div>
            <p className="text-sm text-stone-600">
              Link verifikasi tidak lengkap. Buka kembali link dari email Anda.
            </p>
            <Link to="/login" className="mt-4 inline-block font-semibold text-brand-700 hover:text-brand-600">
              ← Kembali ke Masuk
            </Link>
          </div>
        )}

        {state === 'success' && (
          <div>
            <p className="rounded-md bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              Email Anda berhasil diverifikasi! 🎉
            </p>
            <Link to="/login">
              <Button type="button" className="mt-4 w-full">
                Masuk
              </Button>
            </Link>
          </div>
        )}

        {state === 'error' && (
          <div>
            <p className="rounded-md bg-red-50 p-4 text-sm text-red-800">{message}</p>
            <Link
              to="/login"
              className="mt-4 inline-block font-semibold text-brand-700 hover:text-brand-600"
            >
              ← Kembali ke Masuk
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
