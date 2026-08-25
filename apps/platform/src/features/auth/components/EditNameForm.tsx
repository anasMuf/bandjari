import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FormField } from '../../../components/molecules/FormField';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { useAuth } from '../AuthContext';
import {
  usePatchUsers,
  getGetUsersQueryKey,
  type PatchUsersMutationResult,
} from '../../../api/endpoints/auth/auth';
import { ApiError } from '../../../api/mutator/custom-instance';

/**
 * Bagian 2 — Edit Profil: ubah nama (E-PROFILE-2026 R6). Email/avatar tidak
 * termasuk iterasi ini (keputusan Q2-A). Sukses → invalidate query user agar
 * seluruh UI (header, identitas) ikut terbarui.
 */
export function EditNameForm() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? '');

  const updateMutation = usePatchUsers({
    mutation: {
      onSuccess: (response: PatchUsersMutationResult) => {
        if (response.status === 200) {
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          setName((response.data?.data as { name?: string } | undefined)?.name ?? name);
          addToast({ variant: 'success', title: 'Profil diperbarui', message: 'Nama Anda berhasil disimpan.' });
        }
      },
      onError: (error: Error) => {
        addToast({
          variant: 'error',
          title: 'Gagal menyimpan',
          message: error instanceof ApiError ? error.message : 'Terjadi kesalahan. Silakan coba lagi.',
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ data: { name } });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        id="profile-name"
        name="name"
        type="text"
        label="Nama"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={1}
        maxLength={255}
        autoComplete="name"
      />
      <Button type="submit" disabled={updateMutation.isPending || !name.trim()}>
        {updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}
