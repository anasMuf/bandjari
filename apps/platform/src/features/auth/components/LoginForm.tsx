import { useState } from 'react';
import { FormField } from '../../../components/molecules/FormField';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { usePostAuthLogin, type postAuthLoginResponse } from '../../../api/endpoints/auth/auth';
import { ApiError } from '../../../api/mutator/custom-instance';
import { useAuth } from '../AuthContext';

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth();
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

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
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email: formData.email, password: formData.password } });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField
        id="email"
        name="email"
        type="email"
        label="Email"
        onChange={handleChange}
        required
      />

      <FormField
        id="password"
        name="password"
        type="password"
        label="Kata sandi"
        onChange={handleChange}
        required
      />

      <Button
        type="submit"
        className="w-full"
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending ? 'Memproses...' : 'Masuk'}
      </Button>
    </form>
  );
}
