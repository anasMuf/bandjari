import { useState } from 'react';
import { FormField } from '../../../components/molecules/FormField';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { usePostAuthRegister, type postAuthRegisterResponse } from '../../../api/endpoints/auth/auth';
import { ApiError, customInstance } from '../../../api/mutator/custom-instance';
import { useResendCooldown } from '../useResendCooldown';

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  // Setelah daftar sukses → layar "cek email" (verifikasi sudah dikirim backend).
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  // Cooldown langsung aktif: email verifikasi sudah terkirim saat daftar.
  const { remaining, active, start } = useResendCooldown(true);

  const registerMutation = usePostAuthRegister({
    mutation: {
      onSuccess: (response: postAuthRegisterResponse) => {
        if (response.status === 201) {
          addToast({ variant: 'success', title: 'Akun berhasil dibuat!', message: 'Link verifikasi dikirim ke email Anda.' });
          setRegisteredEmail(formData.email);
        }
      },
      onError: (error: Error) => {
        const message = error instanceof ApiError
          ? error.message
          : 'Terjadi kesalahan tak terduga. Silakan coba lagi.';
        addToast({ variant: 'error', title: 'Pendaftaran gagal', message });
      }
    }
  });

  const resend = async () => {
    if (!registeredEmail) return;
    start(); // restart cooldown 60s
    setResending(true);
    try {
      await customInstance('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: registeredEmail }),
      });
      addToast({ variant: 'success', title: 'Link dikirim ulang', message: `Cek inbox ${registeredEmail} (termasuk folder spam).` });
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Gagal kirim ulang',
        message: error instanceof ApiError ? error.message : 'Terjadi kesalahan. Silakan coba lagi.',
      });
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ data: formData });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (registeredEmail) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Akun berhasil dibuat! 🎉</p>
          <p className="mt-1 text-sm text-emerald-800">
            Link verifikasi dikirim ke <span className="font-medium">{registeredEmail}</span>.
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Buka link di email untuk mengonfirmasi alamat Anda (cek juga folder spam).
          </p>
        </div>
        <Button type="button" variant="secondary" className="w-full" disabled={resending || active} onClick={() => void resend()}>
          {active ? `Kirim ulang link (${remaining}s)` : resending ? 'Mengirim...' : 'Kirim ulang link'}
        </Button>
        <Button type="button" className="w-full" onClick={onSuccess}>
          Lanjut ke login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField
        id="name" name="name" type="text" label="Nama"
        onChange={handleChange} required maxLength={255} minLength={1}
      />

      <FormField
        id="email" name="email" type="email" label="Email"
        onChange={handleChange} required maxLength={255}
      />

      <FormField
        id="password" name="password" type="password" label="Kata sandi"
        onChange={handleChange} required minLength={8} maxLength={72}
      />

      <Button
        type="submit"
        className="w-full"
        disabled={registerMutation.isPending}
      >
        {registerMutation.isPending ? 'Membuat akun...' : 'Daftar'}
      </Button>
    </form>
  );
}
