import { Link } from '@tanstack/react-router';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Explore' },
  { to: '/project', label: 'Project' },
  { to: '/profile', label: 'Profile' },
] as const;

const activeNavClass = 'text-brand-800 font-semibold';

/**
 * Navbar atas desktop (4 menu utama): brand + Home/Explore/Project/Profile.
 * Di mobile navbar ini disembunyikan — navigasi pindah ke BottomNav.
 */
export function AppNav() {
  return (
    <nav
      aria-label="Navigasi utama"
      className="border-b border-stone-200 bg-white max-sm:hidden"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="BandJari — Home">
          <span
            className="flex size-7 items-center justify-center rounded-md bg-brand-800 text-sm font-bold text-white"
            aria-hidden="true"
          >
            B
          </span>
          <span className="text-lg font-bold tracking-tight text-stone-900">BandJari</span>
        </Link>

        <div className="flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm text-stone-600 hover:text-stone-900"
              activeProps={{ className: activeNavClass }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
