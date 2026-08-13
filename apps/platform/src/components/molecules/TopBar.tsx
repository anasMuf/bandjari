import { Link } from '@tanstack/react-router';
import { Button } from '../atoms/Button';

interface TopBarProps {
  /** Mode tamu (beranda tanpa login) vs mode aplikasi (sudah login). */
  variant: 'guest' | 'app';
  userName?: string | null;
  onLogout?: () => void;
}

const activeNavClass = 'text-brand-800 font-semibold';

/**
 * Bilah atas konsisten di seluruh layar: brand + navigasi + status user.
 * Dipakai beranda (guest) dan layout terautentikasi (app).
 */
export function TopBar({ variant, userName, onLogout }: TopBarProps) {
  return (
    <nav className="border-b border-stone-200 bg-white" aria-label="Navigasi utama">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="flex items-center gap-2" aria-label="BandJari — Beranda">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand-800 text-sm font-bold text-white" aria-hidden="true">
              B
            </span>
            <span className="truncate text-lg font-bold tracking-tight text-stone-900">
              BandJari
            </span>
          </Link>
          <span className="hidden text-xs text-stone-400 sm:inline">
            bermain seperti band, cukup dengan jari
          </span>
        </div>

        {variant === 'app' ? (
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-stone-600 hover:text-stone-900" activeProps={{ className: activeNavClass }}>
              Lagu Bawaan
            </Link>
            <Link to="/songs" className="text-sm text-stone-600 hover:text-stone-900" activeProps={{ className: activeNavClass }}>
              Lagu Saya
            </Link>
            <Link to="/samples" className="text-sm text-stone-600 hover:text-stone-900" activeProps={{ className: activeNavClass }}>
              Sample
            </Link>
            <span className="hidden text-sm text-stone-500 sm:inline">{userName ?? 'User'}</span>
            <Button type="button" variant="secondary" size="sm" onClick={onLogout}>
              Logout
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="text-sm font-medium text-stone-600 hover:text-stone-900">
              Masuk
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-md bg-brand-800 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Daftar
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
