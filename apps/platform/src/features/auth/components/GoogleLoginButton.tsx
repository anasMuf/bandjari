import { Button } from '../../../components/atoms/Button';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

interface GoogleLoginButtonProps {
  /** Label tombol — default "Masuk dengan Google". */
  label?: string;
}

/**
 * Tombol "Masuk dengan Google" — redirect penuh ke endpoint OAuth backend
 * (bukan fetch; alur callback server-side lalu SPA pulih session via cookie).
 */
export function GoogleLoginButton({ label = 'Masuk dengan Google' }: GoogleLoginButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      onClick={() => {
        window.location.href = `${API_URL}/auth/google`;
      }}
    >
      {label}
    </Button>
  );
}
