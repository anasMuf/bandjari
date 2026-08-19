import { Link } from '@tanstack/react-router';
import { Compass, FolderKanban, House, User } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: House },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/project', label: 'Project', icon: FolderKanban },
  { to: '/profile', label: 'Profile', icon: User },
] as const;

/**
 * Bottom navigation mobile (4 menu utama) — ikon + label kecil, aman dari
 * safe-area (notch iPhone). Di desktop disembunyikan (pakai AppNav).
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className="flex flex-col items-center gap-1 py-2 text-stone-500 transition-colors hover:text-stone-900"
              activeProps={{ className: 'text-brand-800' }}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
