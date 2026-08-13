import { Fragment } from 'react';
import { getSamplesIdPlaybackUrl } from '../../../api/endpoints/samples/samples';
import { Badge } from '../../../components/atoms/Badge';
import { decodeSteps, MIN_GRID_COLUMNS, stepCount } from '../../../lib/steps';
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
  readOnly?: boolean;
  onEditAttempt?: () => void;
  /** Kolom yang sedang disorot playhead saat Play Preview aktif. */
  playheadIndex?: number | null;
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
  readOnly = false,
  onEditAttempt,
  playheadIndex = null,
}: SequencerGridProps) {
  const ordered = PART_ORDER.map((p) => parts.find((part) => part.part === p)).filter(
    (p): p is GridPart => Boolean(p),
  );
  // Part yang belum ada di daftar API (data tidak lengkap) ikut ditampilkan kosong.
  const known = new Set(ordered.map((p) => p.id));
  for (const part of parts) {
    if (!known.has(part.id)) ordered.push(part);
  }

  const maxLen = Math.max(
    MIN_GRID_COLUMNS,
    ...ordered.map((part) => stepCount(stepsByPart[part.id] ?? part.steps)),
  );

  const stepsOf = (part: GridPart) => stepsByPart[part.id] ?? part.steps;

  return (
    <div className="mt-4 overflow-x-auto rounded-lg bg-white ring-1 ring-stone-900/5">
      <table className="border-separate border-spacing-0 text-xs" aria-label="Grid pola pukulan semua part">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-56 border-b border-stone-200 bg-white px-3 py-2 text-left align-bottom text-xs font-semibold text-stone-500"
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
            return (
              <Fragment key={part.id}>
                {/* Subheader Part */}
                <tr className="bg-stone-50">
                  <td
                    colSpan={maxLen + 1}
                    className="border-y border-stone-200 px-3 py-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-stone-800">{partLabel}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-stone-500">{cells.length} step</span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => onManagePart(part.id)}
                            className="rounded px-1.5 py-0.5 text-brand-700 underline-offset-2 hover:underline cursor-pointer"
                          >
                            Kelola bunyi
                          </button>
                        )}
                      </span>
                    </div>
                  </td>
                </tr>

                {part.slots.map((slot) => {
                  const sampleName = slot.sample?.name ?? null;
                  const isTemplate = slot.sample?.is_system_template === true;
                  return (
                    <tr key={slot.id}>
                      <td className="sticky left-0 z-10 border-b border-stone-100 bg-white px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Preview bunyi ${slot.label} ${partLabel}`}
                            title={`Preview ${slot.label} (${slot.key})`}
                            onClick={() => onPreviewSlot(slot)}
                            className="flex size-6 shrink-0 items-center justify-center rounded border border-stone-200 text-[10px] text-stone-500 transition-colors hover:border-brand-700 hover:text-brand-700 cursor-pointer"
                          >
                            ▶
                          </button>
                          <div className="min-w-0">
                            <p className="font-medium text-stone-900">
                              {slot.label} <span className="font-mono text-stone-400">({slot.key})</span>
                            </p>
                            {sampleName ? (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-stone-500">
                                {isTemplate && <Badge>SYS</Badge>}
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
                                'h-8 w-full min-w-8 border-b border-stone-100 font-mono text-xs transition-colors cursor-pointer',
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

                {/* Baris + Tambah Bunyi per Part */}
                <tr>
                  <td colSpan={maxLen + 1} className="border-t border-stone-100 px-3 py-1.5">
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
                      + Tambah Bunyi untuk {partLabel}
                    </button>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Preview satu sample (per baris grid, FR-SEQ-05): ambil signed URL lalu putar
 * sekali lewat elemen Audio.
 */
export async function previewSampleAudio(sampleId: number): Promise<void> {
  const resp = await getSamplesIdPlaybackUrl(sampleId);
  const url = (resp.data as { data?: { url?: string } })?.data?.url;
  if (!url) return;
  await new Audio(url).play();
}
