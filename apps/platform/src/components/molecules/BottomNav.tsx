import { Link, useLocation } from '@tanstack/react-router';
import { Compass, FolderKanban, House, User } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: House },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/project', label: 'Project', icon: FolderKanban },
  { to: '/profile', label: 'Profile', icon: User },
] as const;

/**
 * Halaman support (Donasi, FAQ, Bantuan, Kontak, Tentang, Legal) diakses dari
 * Profile di mobile — Profile tetap disorot selama berada di seksi ini agar
 * pengguna tidak kehilangan orientasi (pola tab-seksi-aktif pada sub-halaman).
 */
const PROFILE_SECTION_PATHS = [
  '/donasi',
  '/faq',
  '/bantuan',
  '/kontak',
  '/tentang',
  '/privasi',
  '/syarat',
] as const;

/**
 * Warna aktif & hover memakai variant Tailwind `data-[...]` / `hover:` — BUKAN
 * activeProps dengan class polos. Class warna polos sesama utility saling
 * menimpa sesuai urutan stylesheet (bukan urutan atribut class), sehingga
 * highlight aktif bisa tak terlihat. Attribute selector `data-[status=active]`
 * spesifisitasnya lebih tinggi dan menang atas class polos apa pun.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const inProfileSection = PROFILE_SECTION_PATHS.some((path) => pathname.startsWith(path));

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
              data-section-active={
                item.to === '/profile' && inProfileSection ? 'true' : undefined
              }
              className="flex flex-col items-center gap-1 py-2 text-stone-500 transition-colors hover:text-brand-700 data-[status=active]:text-brand-800 data-[section-active=true]:text-brand-800"
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
