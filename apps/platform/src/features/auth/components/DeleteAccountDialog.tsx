import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ConfirmDialog } from '../../../components/molecules/ConfirmDialog';
import { FormField } from '../../../components/molecules/FormField';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { useAuth } from '../AuthContext';
import { usePostAuthDeleteAccount } from '../../../api/endpoints/auth/auth';
import { ApiError } from '../../../api/mutator/custom-instance';

/**
 * Bagian 5 — Zona Berbahaya: hapus akun (E-PROFILE-2026 R11/R12).
 * Dialog konfirmasi + field password bila akun ber-password (OWASP re-auth);
 * akun Google-only cukup konfirmasi (V2-A). Sukses → logout + kembali ke home.
 */
export function DeleteAccountDialog() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');

  const hasPassword = !!user?.has_password;

  const deleteMutation = usePostAuthDeleteAccount({
    mutation: {
      onSuccess: (response) => {
        if (response.status === 200) {
          addToast({ variant: 'success', title: 'Akun dihapus', message: 'Akun Anda telah dihapus. Terima kasih telah memakai BandJari.' });
          logout();
          navigate({ to: '/' });
        }
      },
      onError: (error: Error) => {
        addToast({
          variant: 'error',
          title: 'Gagal menghapus akun',
          message: error instanceof ApiError ? error.message : 'Terjadi kesalahan. Silakan coba lagi.',
        });
      },
    },
  });

  const handleConfirm = () => {
    deleteMutation.mutate({ data: { password } });
  };

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        Hapus akun
      </Button>
      <ConfirmDialog
        open={open}
        title="Hapus akun BandJari?"
        description="Seluruh lagu, pola, dan data akun Anda akan dihapus. Tindakan ini tidak bisa dibatalkan."
        confirmLabel={deleteMutation.isPending ? 'Menghapus...' : 'Hapus akun'}
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      >
        {hasPassword && (
          <div className="mt-3">
            <FormField
              id="delete-password"
              name="password"
              type="password"
              label="Masukkan password untuk konfirmasi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
