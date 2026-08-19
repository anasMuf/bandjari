import type { ReactNode } from 'react';
import { InfoPopover } from './InfoPopover';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Aksi utama di sisi kanan header (mis. tombol "Buat Song Baru"). */
  actions?: ReactNode;
  /** Breadcrumb / tautan kembali di atas judul. */
  back?: ReactNode;
}

/**
 * Kepala halaman konsisten (h1 + subjudul + aksi) — dipakai di seluruh layar
 * (Daftar Lagu, Library Sample, detail, sequencer, launcher).
 *
 * Responsif: di mobile header menjadi baris kompak 3 zona — back (kiri, ikon),
 * judul (tengah, lebih kecil), dan ikon info (kanan) dengan tooltip berisi
 * subjudul; di desktop layout lengkap seperti semula.
 */
export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 max-sm:sticky max-sm:top-0 max-sm:z-30 max-sm:-mx-4 max-sm:bg-stone-100 max-sm:px-4 max-sm:py-2">
      {/* Mobile: baris kompak — back kiri · judul tengah · ikon info kanan.
          Sticky top saat scroll (sticky di header karena parentnya kontainer halaman). */}
      <div className="flex w-full items-center gap-2 sm:hidden">
        <div className="shrink-0">{back}</div>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-bold tracking-tight text-stone-900">
          {title}
        </h1>
        {subtitle && <InfoPopover content={subtitle} />}
      </div>

      {/* Desktop: layout lengkap (back di atas judul + subjudul) */}
      <div className="hidden sm:block">
        {back}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
