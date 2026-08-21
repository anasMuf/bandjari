import { Link } from '@tanstack/react-router';
import { Heart } from 'lucide-react';

const HELP_LINKS = [
  { to: '/faq', label: 'FAQ' },
  { to: '/bantuan', label: 'Bantuan' },
  { to: '/kontak', label: 'Kontak' },
  { to: '/tentang', label: 'Tentang' },
] as const;

const LEGAL_LINKS = [
  { to: '/privasi', label: 'Kebijakan Privasi' },
  { to: '/syarat', label: 'Syarat & Ketentuan' },
] as const;

/**
 * Footer desktop (di mobile disembunyikan — navigasi support ada di Profile):
 * brand + kolom Bantuan + kolom Legal + CTA Donasi. Dipasang di shell _app.
 */
export function Footer() {
  return (
    <footer className="hidden border-t border-stone-200 bg-white sm:block">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/icon_bandjari.svg" alt="" aria-hidden="true" className="size-6" />
              <span className="text-base font-bold tracking-tight text-stone-900">BandJari</span>
            </div>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
              Penyusun & pemutar pola pukulan rebana Al-Banjari — 4 rebana + 1 bass, cukup
              dengan jari.
            </p>
          </div>

          <nav aria-label="Bantuan">
            <h3 className="text-sm font-semibold text-stone-900">Bantuan</h3>
            <ul className="mt-3 space-y-2">
              {HELP_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-stone-500 hover:text-stone-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h3 className="text-sm font-semibold text-stone-900">Legal</h3>
            <ul className="mt-3 space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-stone-500 hover:text-stone-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="text-sm font-semibold text-stone-900">Dukung Kami</h3>
            <p className="mt-3 text-sm leading-relaxed text-stone-500">
              BandJari gratis dan tanpa iklan. Bantu kelanjutan pengembangan.
            </p>
            <Link
              to="/donasi"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600"
            >
              <Heart className="size-4" aria-hidden="true" />
              Donasi
            </Link>
          </div>
        </div>

        <div className="mt-10 border-t border-stone-100 pt-6 text-xs text-stone-400">
          © {new Date().getFullYear()} BandJari
        </div>
      </div>
    </footer>
  );
}
