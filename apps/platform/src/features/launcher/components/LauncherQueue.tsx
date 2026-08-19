import { useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Trash2, X } from 'lucide-react';
import type { LauncherSection } from '../hooks/useLauncherPlayback';
import { MAX_FINITE_LOOP, type QueueRow } from '../engine/section-player';

interface LauncherQueueProps {
  open: boolean;
  onClose: () => void;
  queue: QueueRow[];
  cursor: number;
  sections: LauncherSection[];
  activeSectionId: number | null;
  onSetLoopCount: (index: number, loopCount: number) => void;
  onRemoveRow: (index: number) => void;
  onMoveRow: (from: number, to: number) => void;
  onClearQueue: () => void;
}

const loopLabel = (count: number) => (count === Infinity ? '∞' : String(count));
const decrement = (count: number) => (count === Infinity ? MAX_FINITE_LOOP : Math.max(1, count - 1));
const increment = (count: number) => (count >= MAX_FINITE_LOOP ? Infinity : count + 1);

/**
 * Daftar antrian Launcher — referensi visual UI queue YouTube: panel slide-in
 * kanan di desktop, bottom sheet di mobile. Baris: nomor urut, nama section,
 * stepper jumlah loop (default ikut setting section, bisa dioverride),
 * drag-drop reorder (tombol ↑/↓ sebagai fallback touch), dan hapus per baris.
 * Antrian PERSISTEN — baris yang sudah dimainkan tidak hilang otomatis.
 */
export function LauncherQueue({
  open,
  onClose,
  queue,
  cursor,
  sections,
  activeSectionId,
  onSetLoopCount,
  onRemoveRow,
  onMoveRow,
  onClearQueue,
}: LauncherQueueProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (!open) return null;

  return (
    <>
      {/* Backdrop hanya di mobile (bottom sheet); desktop cukup tombol toggle/✕. */}
      <div
        className="fixed inset-0 z-30 bg-stone-900/40 sm:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        aria-label="Daftar antrian"
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[70vh] flex-col rounded-t-2xl bg-white shadow-2xl ring-1 ring-stone-900/10 max-sm:animate-[slideUp_180ms_ease-out] sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-96 sm:rounded-none sm:rounded-l-2xl sm:animate-[slideIn_180ms_ease-out]"
      >
        <header className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">
            Antrian <span className="text-stone-400">({queue.length})</span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClearQueue}
              disabled={queue.length === 0}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              Bersihkan
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup daftar antrian"
              className="rounded-md p-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {queue.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">
            Antrian kosong — <span className="font-semibold text-stone-700">Mode Biasa</span> aktif.
            Klik tombol <span className="font-semibold text-stone-700">+</span> di pojok kanan atas pad
            untuk mengaktifkan mode antrian.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto">
            {queue.map((row, index) => {
              const section = sections.find((s) => s.id === row.sectionId);
              const isActive = row.sectionId === activeSectionId;
              const isNext = index === cursor && !isActive;
              const name = section?.name ?? `Section #${row.sectionId}`;
              return (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: append-only memungkinkan section sama muncul berkali-kali — key komposit sectionId+indeks
                  key={`${row.sectionId}-${index}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', String(index));
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverIndex(index);
                  }}
                  onDragLeave={() => setDragOverIndex((prev) => (prev === index ? null : prev))}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOverIndex(null);
                    const from = Number(event.dataTransfer.getData('text/plain'));
                    if (!Number.isNaN(from) && from !== index) onMoveRow(from, index);
                  }}
                  onDragEnd={() => setDragOverIndex(null)}
                  className={[
                    'flex items-center gap-2 px-3 py-2 transition-colors',
                    dragOverIndex === index ? 'bg-brand-50' : 'bg-white',
                    isActive ? 'bg-brand-50/60' : '',
                  ].join(' ')}
                >
                  <GripVertical className="size-4 shrink-0 cursor-grab text-stone-300" aria-hidden="true" />

                  <span className="w-5 shrink-0 text-center text-xs font-bold text-stone-400">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">{name}</p>
                    <p className="text-xs text-stone-500">
                      {isActive
                        ? 'sedang main'
                        : isNext
                          ? 'berikutnya'
                          : `loop ${loopLabel(row.loopCount)}×`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center rounded-md ring-1 ring-stone-200">
                    <button
                      type="button"
                      onClick={() => onSetLoopCount(index, decrement(row.loopCount))}
                      disabled={row.loopCount === 1}
                      aria-label={`Kurangi jumlah loop ${name}`}
                      className="px-1.5 py-1 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      −
                    </button>
                    <span
                      className="min-w-7 px-0.5 text-center text-xs font-bold text-stone-800"
                      title={`Loop ${name}: ${loopLabel(row.loopCount)}×`}
                    >
                      {loopLabel(row.loopCount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSetLoopCount(index, increment(row.loopCount))}
                      disabled={row.loopCount === Infinity}
                      aria-label={`Tambah jumlah loop ${name}`}
                      className="px-1.5 py-1 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => onMoveRow(index, index - 1)}
                      disabled={index === 0}
                      aria-label={`Naikkan urutan ${name}`}
                      className="rounded p-0.5 text-stone-400 transition-colors hover:text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveRow(index, index + 1)}
                      disabled={index === queue.length - 1}
                      aria-label={`Turunkan urutan ${name}`}
                      className="rounded p-0.5 text-stone-400 transition-colors hover:text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveRow(index)}
                    aria-label={`Hapus ${name} dari antrian`}
                    className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="border-t border-stone-100 px-4 py-2 text-xs text-stone-400">
          Baris yang sudah dimainkan tetap di daftar (riwayat). Urutan bisa diatur via drag atau tombol ↑/↓. Bersihkan semua antrian untuk kembali ke Mode Biasa.
        </footer>
      </aside>
    </>
  );
}
