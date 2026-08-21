import { useState } from 'react';
import { Check, Copy, HandCoins, Landmark, Wallet } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useToast } from '../../../components/molecules/Toast';
import { SupportPageLayout } from './SupportPageLayout';
import { CONTACT, DONATION_METHODS, type DonationMethod } from '../supportConfig';

/**
 * Halaman Donasi — dukungan pengembangan. Menampilkan metode donasi dari
 * supportConfig.ts (bank/e-wallet) dengan tombol salin nomor ke clipboard.
 * Tanpa integrasi pembayaran: cukup nomor + salin (keputusan desain #3).
 */
export function DonateView() {
  const { addToast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (method: DonationMethod) => {
    try {
      await navigator.clipboard.writeText(method.number);
      setCopiedId(method.id);
      addToast({
        variant: 'success',
        title: 'Nomor disalin',
        message: `Nomor ${method.name} sudah di clipboard.`,
      });
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      addToast({
        variant: 'error',
        title: 'Gagal menyalin otomatis',
        message: `Salin manual: ${method.number}`,
      });
    }
  };

  return (
    <SupportPageLayout
      title="Donasi"
      subtitle="Dukung pengembangan BandJari — biaya server, storage audio, dan fitur baru."
    >
      <div className="rounded-lg bg-white px-5 py-6 ring-1 ring-stone-900/5 sm:px-8 sm:py-8">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <HandCoins className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              BandJari gratis — dan butuh dukunganmu 🙏
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              Semua fitur BandJari gratis dan tanpa iklan. Donasi dari pengguna seperti Anda
              membantu menutup biaya server, penyimpanan sample audio, dan waktu pengembangan
              fitur baru. Pilih metode di bawah, salin nomornya, lalu kirim donasi — nominal
              berapa pun sangat berarti.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DONATION_METHODS.map((method) => {
            const Icon = method.type === 'ewallet' ? Wallet : Landmark;
            const isCopied = copiedId === method.id;

            return (
              <div
                key={method.id}
                className="flex flex-col rounded-lg bg-stone-50 p-4 ring-1 ring-stone-900/5"
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-brand-700" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-stone-900">{method.name}</h3>
                </div>
                <p className="mt-3 font-mono text-lg font-bold tracking-wide text-stone-900">
                  {method.number}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">a.n. {method.holder}</p>
                <button
                  type="button"
                  onClick={() => handleCopy(method)}
                  className="mt-4 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                >
                  {isCopied ? (
                    <>
                      <Check className="size-3.5" aria-hidden="true" /> Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" /> Salin Nomor
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-relaxed text-stone-600">
          <span className="font-semibold text-stone-800">Setelah donasi:</span> jika ingin
          memberi kabar atau menanyakan status pengembangan, hubungi kami via{' '}
          <a
            href={`mailto:${CONTACT.email}`}
            className="font-medium text-brand-700 hover:underline"
          >
            email
          </a>{' '}
          atau WhatsApp di halaman{' '}
          <Link to="/kontak" className="font-medium text-brand-700 hover:underline">
            Kontak
          </Link>
          . Terima kasih telah mendukung BandJari! 💚
        </p>
      </div>
    </SupportPageLayout>
  );
}
