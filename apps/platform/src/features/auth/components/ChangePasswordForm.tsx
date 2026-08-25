import { useState } from 'react';
import { FormField } from '../../../components/molecules/FormField';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { usePostAuthChangePassword } from '../../../api/endpoints/auth/auth';
import { ApiError } from '../../../api/mutator/custom-instance';

/**
 * Bagian 3a — Ganti password (akun ber-password). Wajib password lama (OWASP
 * re-authentication) + konfirmasi password baru client-side (E-PROFILE-2026 R7).
 */
export function ChangePasswordForm() {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({ current_password: '', new_password: '', confirm: '' });
  const [matchError, setMatchError] = useState<string | null>(null);

  const changeMutation = usePostAuthChangePassword({
    mutation: {
      onSuccess: (response) => {
        if (response.status === 200) {
          addToast({ variant: 'success', title: 'Password diubah', message: 'Sesi perangkat lain telah diputus.' });
          setFormData({ current_password: '', new_password: '', confirm: '' });
          setMatchError(null);
        }
      },
      onError: (error: Error) => {
        addToast({
          variant: 'error',
          title: 'Gagal mengubah password',
          message: error instanceof ApiError ? error.message : 'Terjadi kesalahan. Silakan coba lagi.',
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.new_password !== formData.confirm) {
      setMatchError('Konfirmasi password tidak cocok.');
      return;
    }
    setMatchError(null);
    changeMutation.mutate({ data: { current_password: formData.current_password, new_password: formData.new_password } });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        id="current-password"
        name="current_password"
        type="password"
        label="Password lama"
        value={formData.current_password}
        onChange={handleChange}
        required
        autoComplete="current-password"
      />
      <FormField
        id="new-password"
        name="new_password"
        type="password"
        label="Password baru"
        value={formData.new_password}
        onChange={handleChange}
        required
        minLength={8}
        maxLength={72}
        autoComplete="new-password"
      />
      <FormField
        id="confirm-password"
        name="confirm"
        type="password"
        label="Konfirmasi password baru"
        value={formData.confirm}
        onChange={handleChange}
        required
        minLength={8}
        maxLength={72}
        autoComplete="new-password"
      />
      {matchError && <p className="text-sm text-red-600">{matchError}</p>}
      <Button type="submit" disabled={changeMutation.isPending}>
        {changeMutation.isPending ? 'Mengubah...' : 'Ganti password'}
      </Button>
    </form>
  );
}
