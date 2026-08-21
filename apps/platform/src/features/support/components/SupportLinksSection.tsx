import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { SUPPORT_LINKS } from '../supportConfig';

/**
 * Seksi "Bantuan & Informasi" — daftar tautan halaman support (Donasi, FAQ,
 * Bantuan, Kontak, Tentang, Privasi, Syarat). Dipasang di halaman Profile
 * sebagai pintu akses support di mobile (keputusan desain #1).
 */
export function SupportLinksSection() {
  return (
    <section aria-labelledby="support-links-heading" className="mt-6 rounded-lg bg-white ring-1 ring-stone-900/5">
      <h2
        id="support-links-heading"
        className="border-b border-stone-100 px-5 py-3.5 text-sm font-semibold text-stone-900"
      >
        Bantuan & Informasi
      </h2>
      <ul className="divide-y divide-stone-100">
        {SUPPORT_LINKS.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="flex items-center justify-between px-5 py-3.5 text-sm text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
            >
              {link.label}
              <ChevronRight className="size-4 text-stone-300" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
