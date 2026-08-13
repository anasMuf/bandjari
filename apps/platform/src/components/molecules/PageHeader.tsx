import type { ReactNode } from 'react';

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
 */
export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {back}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
