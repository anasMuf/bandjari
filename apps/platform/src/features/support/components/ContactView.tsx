import { LifeBuoy, Mail, MessageCircle, MessageCircleQuestion } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { SupportPageLayout } from './SupportPageLayout';
import { CONTACT } from '../supportConfig';

const WA_MESSAGE = encodeURIComponent(
  'Halo BandJari, saya ingin bertanya tentang BandJari.'
);

/**
 * Halaman Kontak — info kontak statis dari supportConfig.ts + tombol aksi
 * mailto / WhatsApp. Tanpa backend & tanpa form kirim (keputusan desain #5).
 */
export function ContactView() {
  return (
    <SupportPageLayout
      title="Kontak"
      subtitle="Punya pertanyaan, saran, atau menemukan kendala? Sampaikan langsung."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href={`mailto:${CONTACT.email}`}
          className="group rounded-lg bg-white p-5 ring-1 ring-stone-900/5 transition-colors hover:ring-brand-700/40"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Mail className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-stone-900">Email</h2>
          <p className="mt-1 text-sm text-stone-500">{CONTACT.email}</p>
          <p className="mt-2 text-xs font-medium text-brand-700 group-hover:underline">
            Kirim email →
          </p>
        </a>

        <a
          href={`https://wa.me/${CONTACT.whatsapp}?text=${WA_MESSAGE}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-lg bg-white p-5 ring-1 ring-stone-900/5 transition-colors hover:ring-brand-700/40"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <MessageCircle className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-stone-900">WhatsApp</h2>
          <p className="mt-1 text-sm text-stone-500">Chat langsung dengan {CONTACT.whatsappName}</p>
          <p className="mt-2 text-xs font-medium text-brand-700 group-hover:underline">
            Buka chat →
          </p>
        </a>
      </div>

      <div className="mt-3 rounded-lg bg-white px-5 py-4 ring-1 ring-stone-900/5">
        <p className="text-xs leading-relaxed text-stone-600">
          <span className="font-semibold text-stone-800">Waktu respons:</span> pesan umumnya
          dibalas dalam 1×24 jam kerja. Untuk pertanyaan yang sudah sering ditanyakan, coba
          periksa{' '}
          <Link to="/faq" className="font-medium text-brand-700 hover:underline">
            FAQ
          </Link>{' '}
          terlebih dahulu — kemungkinan jawabannya sudah ada di sana.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/bantuan"
          className="flex items-center gap-3 rounded-lg bg-white p-4 ring-1 ring-stone-900/5 transition-colors hover:ring-brand-700/40"
        >
          <LifeBuoy className="size-5 shrink-0 text-brand-700" aria-hidden="true" />
          <span className="text-sm font-medium text-stone-700">Panduan Bantuan</span>
        </Link>
        <Link
          to="/faq"
          className="flex items-center gap-3 rounded-lg bg-white p-4 ring-1 ring-stone-900/5 transition-colors hover:ring-brand-700/40"
        >
          <MessageCircleQuestion className="size-5 shrink-0 text-brand-700" aria-hidden="true" />
          <span className="text-sm font-medium text-stone-700">Pertanyaan Umum (FAQ)</span>
        </Link>
      </div>
    </SupportPageLayout>
  );
}
