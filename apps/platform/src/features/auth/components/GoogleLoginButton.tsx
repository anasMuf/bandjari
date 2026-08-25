import { Button } from '../../../components/atoms/Button';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

interface GoogleLoginButtonProps {
  /** Label tombol — default "Masuk dengan Google". */
  label?: string;
  /** Mode LINK (hubungkan Google ke akun yang sedang login) — redirect ?link=1. */
  link?: boolean;
  /** Kelas tambahan untuk Button. */
  className?: string;
}

/**
 * Tombol "Masuk dengan Google" — redirect penuh ke endpoint OAuth backend
 * (bukan fetch; alur callback server-side lalu SPA pulih session via cookie).
 * `link` = hubungkan ke akun existing (dari halaman Profile, E-PROFILE-2026 R3).
 */
export function GoogleLoginButton({ label = 'Masuk dengan Google', link = false, className = '' }: GoogleLoginButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      onClick={() => {
        window.location.href = `${API_URL}/auth/google${link ? '?link=1' : ''}`;
      }}
    >
      {label}
    </Button>
  );
}
