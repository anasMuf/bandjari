import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FormField } from '../../../components/molecules/FormField';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { usePostAuthSetPassword, getGetUsersQueryKey } from '../../../api/endpoints/auth/auth';
import { ApiError } from '../../../api/mutator/custom-instance';

/**
 * Bagian 3a — Set password untuk akun Google-only (tanpa password). Prasyarat
 * sebelum unlink Google (E-PROFILE-2026 R8). Sukses → invalidate user query
 * agar `has_password` terbarui.
 */
export function SetPasswordForm() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ new_password: '', confirm: '' });
  const [matchError, setMatchError] = useState<string | null>(null);

  const setMutation = usePostAuthSetPassword({
    mutation: {
      onSuccess: (response) => {
        if (response.status === 200) {
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          addToast({ variant: 'success', title: 'Password dibuat', message: 'Akun Anda kini punya password. Anda bisa memutuskan Google kapan saja.' });
          setFormData({ new_password: '', confirm: '' });
          setMatchError(null);
        }
      },
      onError: (error: Error) => {
        addToast({
          variant: 'error',
          title: 'Gagal membuat password',
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
    setMutation.mutate({ data: { new_password: formData.new_password } });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-stone-600">
        Akun Anda dibuat dengan Google dan belum punya password. Buat password
        agar bisa masuk tanpa Google dan memutuskan koneksi Google.
      </p>
      <FormField
        id="set-new-password"
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
        id="set-confirm-password"
        name="confirm"
        type="password"
        label="Konfirmasi password"
        value={formData.confirm}
        onChange={handleChange}
        required
        minLength={8}
        maxLength={72}
        autoComplete="new-password"
      />
      {matchError && <p className="text-sm text-red-600">{matchError}</p>}
      <Button type="submit" disabled={setMutation.isPending}>
        {setMutation.isPending ? 'Menyimpan...' : 'Buat password'}
      </Button>
    </form>
  );
}
