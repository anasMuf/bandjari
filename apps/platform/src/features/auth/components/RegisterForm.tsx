import { useState } from 'react';
import { FormField } from '../../../components/molecules/FormField';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { usePostAuthRegister, type postAuthRegisterResponse } from '../../../api/endpoints/auth/auth';
import { ApiError } from '../../../api/mutator/custom-instance';

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const registerMutation = usePostAuthRegister({
    mutation: {
      onSuccess: (response: postAuthRegisterResponse) => {
        if (response.status === 201) {
          addToast({ variant: 'success', title: 'Akun berhasil dibuat!', message: 'Silakan masuk dengan akun baru Anda.' });
          onSuccess();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ data: formData });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
        onChange={handleChange} required minLength={6} maxLength={255}
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
