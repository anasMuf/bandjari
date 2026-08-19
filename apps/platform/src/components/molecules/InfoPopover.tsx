import { useState } from 'react';
import { Info, X } from 'lucide-react';

interface InfoPopoverProps {
  /** Teks yang ditampilkan saat ikon diklik (mis. subjudul yang disembunyikan di mobile). */
  content: string;
  /** Nama aksesibel tombol; default = konten. */
  ariaLabel?: string;
}

/**
 * Pengganti tooltip hover yang bisa DIKLIK (mobile-friendly): ikon info → popover.
 * Ditutup dengan klik di luar, klik ikon lagi, atau tombol ✕.
 */
export function InfoPopover({ content, ariaLabel }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={ariaLabel ?? content}
        className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
      >
        <Info className="size-4" />
      </button>

      {open && (
        <>
          {/* Klik di luar popover = tutup. */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden="true" />

          <div
            role="dialog"
            aria-label={ariaLabel ?? content}
            className="absolute top-full right-0 z-30 mt-2 w-64 rounded-lg border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600 shadow-lg"
          >
            <div className="flex items-start justify-between gap-2">
              <p>{content}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="shrink-0 rounded p-0.5 text-stone-400 transition-colors hover:text-stone-700 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
