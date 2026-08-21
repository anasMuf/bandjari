/**
 * Konfigurasi statis halaman support (Donasi, Kontak) & daftar link.
 *
 * ⚠️ PLACEHOLDER — ganti nilai berikut dengan data asli sebelum produksi:
 * - Donasi: nomor rekening/e-wallet asli & atas nama
 * - Kontak: email & nomor WhatsApp yang aktif
 */

export interface DonationMethod {
  id: string;
  /** Nama metode, mis. "Bank BCA" / "DANA". */
  name: string;
  /** Kategori — menentukan ikon kartu. */
  type: 'bank' | 'ewallet';
  /** Nomor rekening / ID e-wallet. */
  number: string;
  /** Atas nama pemilik. */
  holder: string;
}

/** Metode donasi — urutkan dari yang paling diutamakan. */
export const DONATION_METHODS: DonationMethod[] = [
  { id: 'bank-bca', name: 'Bank BCA', type: 'bank', number: '0500576880', holder: 'M ANAS MUFTI AKBAR' },
  { id: 'bank-jago', name: 'Bank Jago', type: 'bank', number: '103319408077', holder: 'M ANAS MUFTI AKBAR' },
  { id: 'shopeepay', name: 'ShopeePay', type: 'ewallet', number: '0895621071043', holder: 'M ANAS MUFTI AKBAR' },
];

/** Kontak support — dipakai halaman Kontak (mailto / WhatsApp). */
export const CONTACT = {
  email: 'anas.muhammadakbar@gmail.com',
  /** Format internasional tanpa "+" / spasi, mis. "6281234567890". */
  whatsapp: '62895621071043',
  /** Nama tampilan untuk sapaan WhatsApp. */
  whatsappName: 'Anas',
};

/** Daftar tautan support — dipakai seksi mobile di Profile & footer. */
export const SUPPORT_LINKS = [
  { to: '/donasi', label: 'Donasi' },
  { to: '/faq', label: 'FAQ' },
  { to: '/bantuan', label: 'Bantuan' },
  { to: '/kontak', label: 'Kontak' },
  { to: '/tentang', label: 'Tentang' },
  { to: '/privasi', label: 'Kebijakan Privasi' },
  { to: '/syarat', label: 'Syarat & Ketentuan' },
] as const;
