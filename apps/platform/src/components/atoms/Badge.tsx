interface BadgeProps {
  children: React.ReactNode;
  /** 'system' = label kecil SYSTEM untuk konten Template System; 'star' = BPM override. */
  variant?: 'system' | 'star';
  className?: string;
}

/**
 * Badge kecil non-interaktif — dipakai untuk menandai konten bawaan platform
 * (SYSTEM) dan penanda BPM override (★) tanpa mengandalkan warna semata.
 */
export function Badge({ children, variant = 'system', className = '' }: BadgeProps) {
  const styles =
    variant === 'star'
      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/20 ring-inset'
      : 'bg-brand-50 text-brand-800 ring-1 ring-brand-700/20 ring-inset';

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${styles} ${className}`}
    >
      {children}
    </span>
  );
}
