import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: string;
  /** Elemen tambahan di kanan (badge, hint, aksi kecil). */
  aside?: ReactNode;
}

/**
 * Kepala seksi (h2) — dipakai untuk blok "Lagu Bawaan", "Sample Bawaan",
 * "Sample Saya", dsb. tanpa melewati hierarki heading.
 */
export function SectionHeader({ title, subtitle, aside }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-stone-500">{subtitle}</p>}
      </div>
      {aside && <div>{aside}</div>}
    </div>
  );
}
