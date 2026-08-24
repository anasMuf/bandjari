import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { FormField } from '../../../components/molecules/FormField';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { usePostAuthLogin, type postAuthLoginResponse } from '../../../api/endpoints/auth/auth';
import { ApiError, customInstance } from '../../../api/mutator/custom-instance';
import { useAuth } from '../AuthContext';
import { GoogleLoginButton } from './GoogleLoginButton';

type LoginStep = 'email' | 'password' | 'google' | 'none';

/**
 * Login dua langkah (email-first): cek email dulu via POST /auth/check-email,
 * lalu tampilkan langkah yang relevan — akun Google langsung diarahkan ke
 * tombol "Masuk dengan Google" (tanpa minta password yang pasti gagal), akun
 * password lanjut ke form password, email tak dikenal ditawarkan daftar.
 */
export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<LoginStep>('email');
  const [checking, setChecking] = useState(false);

  const loginMutation = usePostAuthLogin({
    mutation: {
      onSuccess: (response: postAuthLoginResponse) => {
        if (response.status === 200 && response.data.token) {
          // Role dari respons login dipakai optimistik — UI admin langsung
          // aktif tanpa menunggu fetch profile (FR-ROLE).
          login(response.data.token, response.data.role);
          addToast({ variant: 'success', title: 'Selamat datang!', message: 'Anda berhasil masuk.' });
          onSuccess();
        }
      },
      onError: (error: Error) => {
        const message = error instanceof ApiError
          ? error.message
          : 'Terjadi kesalahan tak terduga. Silakan coba lagi.';
        addToast({ variant: 'error', title: 'Gagal masuk', message });
      },
    },
  });

  const checkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    try {
      const res = await customInstance<{ data: { method: string } }>('/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      const method = res.data.method;
      setStep(method === 'password' ? 'password' : method === 'google' ? 'google' : 'none');
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Gagal memeriksa email',
        message: error instanceof ApiError ? error.message : 'Terjadi kesalahan. Silakan coba lagi.',
      });
    } finally {
      setChecking(false);
    }
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
  };

  const backToEmail = () => {
    setPassword('');
    setStep('email');
  };

  if (step === 'google') {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-brand-200 bg-brand-50 p-3">
          <p className="text-sm font-medium text-brand-900">Akun ini menggunakan Google</p>
          <p className="mt-1 text-xs text-brand-800">
            {email} terdaftar lewat Google — silakan masuk dengan Google untuk melanjutkan.
          </p>
        </div>
        <GoogleLoginButton />
        <button
          type="button"
          onClick={backToEmail}
          className="w-full cursor-pointer text-center text-sm font-medium text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
        >
          ← Ganti email
        </button>
      </div>
    );
  }

  if (step === 'none') {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
          <p className="text-sm font-medium text-stone-900">Email belum terdaftar</p>
          <p className="mt-1 text-xs text-stone-600">{email} belum punya akun BandJari.</p>
        </div>
        <Link to="/register">
          <Button type="button" className="w-full">
            Daftar dengan email ini
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-stone-300" />
          <span className="text-xs text-stone-400">atau</span>
          <span className="h-px flex-1 bg-stone-300" />
        </div>
        <GoogleLoginButton />
        <button
          type="button"
          onClick={backToEmail}
          className="w-full cursor-pointer text-center text-sm font-medium text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
        >
          ← Ganti email
        </button>
      </div>
    );
  }

  const isPasswordStep = step === 'password';

  return (
    <form
      onSubmit={isPasswordStep ? submitPassword : checkEmail}
      className="space-y-6"
    >
      <FormField
        id="email"
        name="email"
        type="email"
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      {isPasswordStep && (
        <>
          <FormField
            id="password"
            name="password"
            type="password"
            label="Kata sandi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-brand-700 hover:text-brand-600"
            >
              Lupa password?
            </Link>
          </div>
        </>
      )}

      {isPasswordStep ? (
        <>
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? 'Memproses...' : 'Masuk'}
          </Button>
          <button
            type="button"
            onClick={backToEmail}
            className="w-full cursor-pointer text-center text-sm font-medium text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
          >
            ← Ganti email
          </button>
        </>
      ) : (
        <>
          <Button type="submit" className="w-full" disabled={checking}>
            {checking ? 'Memeriksa...' : 'Lanjut'}
          </Button>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-stone-300" />
            <span className="text-xs text-stone-400">atau</span>
            <span className="h-px flex-1 bg-stone-300" />
          </div>
          <GoogleLoginButton />
        </>
      )}
    </form>
  );
}
