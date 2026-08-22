import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown, Heart, LifeBuoy } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Explore' },
  { to: '/project', label: 'Project' },
  { to: '/profile', label: 'Profile' },
] as const;

/** Item dropdown "Bantuan" di navbar desktop. */
const SUPPORT_ITEMS = [
  { to: '/faq', label: 'FAQ' },
  { to: '/bantuan', label: 'Bantuan' },
  { to: '/kontak', label: 'Kontak' },
  { to: '/tentang', label: 'Tentang' },
] as const;

const activeNavClass = 'text-brand-800 font-semibold';

/**
 * Navbar atas desktop: brand + Home/Explore/Project/Profile + dropdown Bantuan
 * (FAQ/Bantuan/Kontak/Tentang) + tombol Donasi (CTA aksen).
 * Di mobile navbar disembunyikan — navigasi pindah ke BottomNav + seksi
 * "Bantuan & Informasi" di halaman Profile.
 */
export function AppNav() {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <nav
      aria-label="Navigasi utama"
      className="border-b border-stone-200 bg-white max-sm:hidden"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="BandJari — Home">
          <img
            src="/icon_bandjari.svg"
            alt=""
            aria-hidden="true"
            className="size-7"
          />
          <span className="text-lg font-bold tracking-tight text-stone-900">BandJari</span>
        </Link>

        <div className="flex items-center gap-5">
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

          {/* Dropdown Bantuan — wrapper flex: tanpa flex, line-box blok membengkak
              oleh strut line-height warisan sehingga tombol tidak sejajar dengan
              menu lain; flex menghilangkan line-box & menyamakan tinggi kotak. */}
          <div className="relative flex">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={supportOpen}
              onClick={() => setSupportOpen((open) => !open)}
              // p-0: preflight Tailwind tidak mereset padding UA tombol — tanpa ini
              // kotak tombol lebih lebar/tinggi dari link menu sehingga label & panel
              // dropdown tidak sejajar (tidak simetris) dengan menu lain.
              className="inline-flex cursor-pointer items-center gap-1 p-0 text-sm text-stone-600 hover:text-stone-900"
            >
              <LifeBuoy className="size-4" aria-hidden="true" />
              Bantuan
              <ChevronDown
                aria-hidden="true"
                className={`size-3.5 transition-transform duration-150 ${supportOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {supportOpen && (
              <>
                {/* Backdrop transparan: klik di luar menutup menu. */}
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden="true"
                  onClick={() => setSupportOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-md bg-white py-1 shadow-lg ring-1 ring-stone-900/5"
                >
                  {SUPPORT_ITEMS.map((item) => (
                    <Link
                      key={item.to}
                      role="menuitem"
                      to={item.to}
                      onClick={() => setSupportOpen(false)}
                      className="block px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* CTA Donasi */}
          <Link
            to="/donasi"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            <Heart className="size-4" aria-hidden="true" />
            Donasi
          </Link>
        </div>
      </div>
    </nav>
  );
}
