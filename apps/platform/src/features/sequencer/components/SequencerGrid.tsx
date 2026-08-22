import { Fragment } from 'react';
import { Loader2, SlidersHorizontal, Trash2, Volume2, VolumeX } from 'lucide-react';
import { decodeSteps, roundUpToStepMultiple, stepCount } from '../../../lib/steps';
import { PART_LABELS, PART_ORDER } from '../utils/parts';

export interface GridSlot {
  id: number;
  label: string;
  key: string;
  sample_id: number | null;
  sample?: { id: number; name: string; is_system_template: boolean } | null;
}

export interface GridPart {
  id: number;
  part: string;
  steps: string;
  slots: GridSlot[];
}

interface SequencerGridProps {
  parts: GridPart[];
  stepsByPart: Record<number, string>;
  onToggleCell: (partId: number, slotKey: string, colIndex: number) => void;
  onPreviewSlot: (slot: GridSlot) => void;
  onManagePart: (partId: number) => void;
  onAddSlot: (partId: number) => void;
  /** Bersihkan seluruh kotak step satu Part. */
  onClearPart: (partId: number) => void;
  readOnly?: boolean;
  onEditAttempt?: () => void;
  /** Kolom yang sedang disorot playhead saat Play Preview aktif. */
  playheadIndex?: number | null;
  /** Sample yang sedang disiapkan preview satu bunyi — tombol ▶-nya menampilkan placeholder. */
  previewingSampleId?: number | null;
  /** Part yang sedang di-mute (senyap saat preview). */
  mutedParts: Set<string>;
  onToggleMute: (partKey: string) => void;
}

/**
 * Grid sequencer terpadu (layar 3 wireframe): semua 5 Part dalam satu tabel.
 * Baris = SoundSlot (jumlah dinamis per Part), kolom = posisi step; kolom
 * melampaui panjang steps suatu Part bertindak sebagai sel ekstensi.
 */
export function SequencerGrid({
  parts,
  stepsByPart,
  onToggleCell,
  onPreviewSlot,
  onManagePart,
  onAddSlot,
  onClearPart,
  readOnly = false,
  onEditAttempt,
  playheadIndex = null,
  previewingSampleId = null,
  mutedParts,
  onToggleMute,
}: SequencerGridProps) {
  const ordered = PART_ORDER.map((p) => parts.find((part) => part.part === p)).filter(
    (p): p is GridPart => Boolean(p),
  );
  // Part yang belum ada di daftar API (data tidak lengkap) ikut ditampilkan kosong.
  const known = new Set(ordered.map((p) => p.id));
  for (const part of parts) {
    if (!known.has(part.id)) ordered.push(part);
  }

  // Kolom selalu kelipatan beat (4), minimal 8 — tidak terpotong di tengah kelompok.
  const maxLen = roundUpToStepMultiple(
    Math.max(...ordered.map((part) => stepCount(stepsByPart[part.id] ?? part.steps)), 0),
  );

  const stepsOf = (part: GridPart) => stepsByPart[part.id] ?? part.steps;

  return (
    <div className="mt-4 overflow-x-auto rounded-lg bg-white ring-1 ring-stone-900/5">
      <table className="border-separate border-spacing-0 text-xs" aria-label="Grid pola pukulan semua part">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-40 border-b border-stone-200 bg-white px-3 py-2 text-left align-bottom text-xs font-semibold text-stone-500 max-sm:min-w-36 sm:min-w-56"
            >
              Part / Bunyi
            </th>
            {Array.from({ length: maxLen }, (_, i) => (
              <th
                // biome-ignore lint/suspicious/noArrayIndexKey: kolom step bersifat posisional (nomor urut), tidak ada identitas lain
                key={i}
                scope="col"
                aria-label={`Langkah ${i + 1}`}
                className={[
                  'min-w-8 border-b border-stone-200 px-1 py-2 text-center font-normal text-stone-400',
                  i % 4 === 0 ? 'border-l-2 border-l-stone-300' : '',
                  // Indikator playhead juga tampil di header — terlihat berjalan
                  // meskipun grid belum punya isi/baris bunyi.
                  playheadIndex === i ? 'bg-brand-100 font-semibold text-brand-800' : '',
                ].join(' ')}
              >
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((part) => {
            const partLabel = PART_LABELS[part.part] ?? part.part;
            const steps = stepsOf(part);
            const cells = decodeSteps(steps);
            const isMuted = mutedParts.has(part.part);
            return (
              <Fragment key={part.id}>
                {/* Subheader Part — sel pertama sticky: nama Part + aksi bersebelahan, tidak ikut scroll horizontal. */}
                <tr className={isMuted ? 'bg-stone-50 opacity-60' : 'bg-stone-50'}>
                  <td className="sticky left-0 z-10 border-y border-stone-200 bg-stone-50 px-3 py-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-stone-800">{partLabel}</span>
                      {isMuted && (
                        <span className="text-[10px] font-bold uppercase text-stone-400">
                          (senyap)
                        </span>
                      )}
                      <span className="text-stone-500">{cells.length} step</span>
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-pressed={isMuted}
                          aria-label={isMuted ? `Bunyikan ${partLabel}` : `Mute ${partLabel}`}
                          title={isMuted ? `Bunyikan ${partLabel}` : `Mute ${partLabel}`}
                          onClick={() => onToggleMute(part.part)}
                          className={[
                            'inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                            isMuted
                              ? 'bg-stone-200 text-stone-500 hover:bg-stone-300'
                              : 'bg-brand-50 text-brand-800 hover:bg-brand-100',
                          ].join(' ')}
                        >
                          {isMuted ? (
                            <VolumeX className="size-4" aria-hidden="true" />
                          ) : (
                            <Volume2 className="size-4" aria-hidden="true" />
                          )}
                          <span className="max-sm:hidden">{isMuted ? 'Mute' : 'Bunyi'}</span>
                        </button>
                        {!readOnly && (
                          <button
                            type="button"
                            title={`Kelola bunyi ${partLabel}`}
                            aria-label={`Kelola bunyi ${partLabel}`}
                            onClick={() => onManagePart(part.id)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-brand-700 underline-offset-2 hover:underline cursor-pointer"
                          >
                            <SlidersHorizontal className="size-4" aria-hidden="true" />
                            <span className="max-sm:hidden">Kelola bunyi</span>
                          </button>
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => onClearPart(part.id)}
                            disabled={cells.length === 0}
                            title={
                              cells.length === 0
                                ? `${partLabel} belum punya langkah`
                                : `Bersihkan semua kotak step ${partLabel}`
                            }
                            aria-label={`Bersihkan semua kotak step ${partLabel}`}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            <span className="max-sm:hidden">Bersihkan step</span>
                          </button>
                        )}
                      </span>
                    </div>
                  </td>
                  {/* Spacer — menutup sisa lebar tabel (area step) tanpa konten. */}
                  <td colSpan={maxLen} className="border-y border-stone-200" aria-hidden="true" />
                </tr>

                {part.slots.map((slot) => {
                  const sampleName = slot.sample?.name ?? null;
                  const isPreviewing =
                    previewingSampleId != null && slot.sample_id === previewingSampleId;
                  return (
                    <tr key={slot.id} className={isMuted ? 'opacity-60' : ''}>
                      <td className="sticky left-0 z-10 border-b border-stone-100 bg-white px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Preview bunyi ${slot.label} ${partLabel}`}
                            title={isPreviewing ? 'Memuat sample…' : `Preview ${slot.label} (${slot.key})`}
                            aria-busy={isPreviewing}
                            onClick={() => onPreviewSlot(slot)}
                            className="flex size-6 shrink-0 items-center justify-center rounded border border-stone-200 text-[10px] text-stone-500 transition-colors hover:border-brand-700 hover:text-brand-700 cursor-pointer"
                          >
                            {isPreviewing ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              '▶'
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className="font-medium text-stone-900">
                              {slot.label} <span className="font-mono text-stone-400">({slot.key})</span>
                            </p>
                            {sampleName ? (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-stone-500">
                                <span className="truncate">{sampleName}</span>
                              </p>
                            ) : (
                              <p className="mt-0.5 italic text-stone-400">belum ada sample</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: maxLen }, (_, colIndex) => {
                        const beyond = colIndex >= cells.length;
                        const active = !beyond && (cells[colIndex]?.includes(slot.key) ?? false);
                        const isBeat = colIndex % 4 === 0;
                        const isPlayhead = playheadIndex != null && colIndex === playheadIndex;
                        return (
                          <td
                            // biome-ignore lint/suspicious/noArrayIndexKey: kolom step bersifat posisional (nomor urut), tidak ada identitas lain
                            key={colIndex}
                            className={isBeat ? 'border-l-2 border-l-stone-300' : ''}
                          >
                            <button
                              type="button"
                              aria-pressed={active}
                              aria-label={`Langkah ${colIndex + 1}, ${slot.label} (${slot.key})${active ? ', aktif' : ''}`}
                              onClick={() => {
                                if (readOnly) {
                                  onEditAttempt?.();
                                  return;
                                }
                                onToggleCell(part.id, slot.key, colIndex);
                              }}
                              className={[
                                'h-8 w-full min-w-8 border-b border-stone-100 font-mono text-xs transition-colors cursor-pointer max-sm:h-10',
                                active ? 'bg-brand-700 text-white' : 'text-stone-300 hover:bg-stone-50',
                                beyond ? 'bg-stone-50' : '',
                                isPlayhead ? 'bg-brand-100' : '',
                                readOnly ? 'cursor-not-allowed opacity-80' : '',
                              ].join(' ')}
                            >
                              {active ? slot.key : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Baris + Tambah Bunyi per Part — sel pertama sticky agar aksi tidak ikut scroll horizontal. */}
                <tr className={isMuted ? 'opacity-60' : ''}>
                  <td className="sticky left-0 z-10 border-t border-stone-100 bg-white px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (readOnly) {
                          onEditAttempt?.();
                          return;
                        }
                        onAddSlot(part.id);
                      }}
                      className="text-xs font-medium text-stone-500 underline-offset-2 hover:text-brand-700 hover:underline cursor-pointer"
                    >
                      + Tambah Bunyi<span className="max-sm:hidden"> untuk {partLabel}</span>
                    </button>
                  </td>
                  {/* Spacer — menutup sisa lebar tabel (area step) tanpa konten. */}
                  <td colSpan={maxLen} className="border-t border-stone-100" aria-hidden="true" />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

