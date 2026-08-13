import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Ikon/karakter besar (mis. "♪" atau "🔒") — hanya dekoratif bila ada teks deskriptif. */
  icon?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

/**
 * State kosong bermakna (bukan layar blank): ikon, judul, penjelasan, dan
 * aksi lanjutan bila ada.
 */
export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div
      aria-live="polite"
      className="mt-6 rounded-lg border-2 border-dashed border-stone-200 p-10 text-center"
    >
      {icon && (
        <div className="text-3xl text-stone-400" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="mt-2 text-sm font-medium text-stone-900">{title}</p>
      {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}
