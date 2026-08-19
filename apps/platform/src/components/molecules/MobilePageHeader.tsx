import { Bell, User } from 'lucide-react';

interface MobilePageHeaderProps {
  /** Judul halaman (Explore / Project / Profile). */
  title?: string;
  /** Nama user (Home) — tampilkan avatar generik + nama; null/undefined = "Tamu". */
  userName?: string | null;
}

/**
 * Header halaman khusus mobile (aplikasi ber-bottom-nav): 2 zona —
 * kiri avatar+nama (Home) atau judul halaman (Explore/Project/Profile),
 * kanan ikon notifikasi (statis — belum ada fungsi).
 * Di desktop disembunyikan; judul desktop ditangani PageHeader/Navbar.
 */
export function MobilePageHeader({ title, userName }: MobilePageHeaderProps) {
  const initial = userName?.trim().charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between gap-2 sm:hidden">
      {userName !== undefined ? (
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white"
          >
            {initial || <User className="size-4" />}
          </span>
          <span className="truncate text-base font-semibold text-stone-900">
            {userName || 'Tamu'}
          </span>
        </div>
      ) : (
        <h1 className="min-w-0 truncate text-lg font-bold tracking-tight text-stone-900">
          {title}
        </h1>
      )}

      <button
        type="button"
        aria-label="Notifikasi (segera hadir)"
        title="Notifikasi — segera hadir"
        className="flex size-9 shrink-0 cursor-default items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-200/60"
      >
        <Bell className="size-5" aria-hidden="true" />
      </button>
    </header>
  );
}
