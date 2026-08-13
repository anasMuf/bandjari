import {
  appendColumn,
  decodeSteps,
  encodeSteps,
  removeColumn,
  setCell,
  type StepCell,
} from '../utils/steps-codec';
import type { SoundSlotData } from './SoundSlotManager';

interface StepGridProps {
  slots: SoundSlotData[];
  steps: string;
  onChange: (steps: string) => void;
  disabled?: boolean;
}

// Akses per baris (bukan satu-satunya indikator — huruf key tetap tampil).
const rowTones = [
  'bg-indigo-600 text-white',
  'bg-teal-600 text-white',
  'bg-amber-500 text-white',
  'bg-rose-600 text-white',
  'bg-emerald-600 text-white',
];

/**
 * Grid sequencer: baris = SoundSlot (key), kolom = posisi step.
 * Klik kotak kosong → isi dengan key baris tsb; klik kotak aktif → hapus
 * langkah tsb (steps memendek). Tombol "+ Langkah" menambah posisi di akhir.
 */
export function StepGrid({ slots, steps, onChange, disabled = false }: StepGridProps) {
  const cells = decodeSteps(steps);
  const defaultKey = slots[0]?.key ?? '';

  const commit = (next: StepCell[]) => onChange(encodeSteps(next));

  const handleCellClick = (slotKey: string, colIndex: number) => {
    if (disabled) return;
    if (cells[colIndex] === slotKey) {
      commit(removeColumn(cells, colIndex));
    } else {
      commit(setCell(cells, colIndex, slotKey));
    }
  };

  const handleAppend = () => {
    if (disabled || !defaultKey) return;
    commit(appendColumn(cells, defaultKey));
  };

  if (slots.length === 0) {
    return (
      <p role="status" className="mt-4 rounded-md bg-gray-50 p-4 text-sm text-gray-500">
        Tambahkan jenis bunyi terlebih dahulu untuk menyusun langkah.
      </p>
    );
  }

  return (
    <section aria-label="Grid steps" className="mt-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Pola Pukulan (Steps)</h3>
        <p className="text-xs text-gray-500">
          {cells.length} langkah · klik kotak aktif untuk menghapus langkah tsb
        </p>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-900/5">
        <div role="grid" aria-label="Grid pola pukulan" className="inline-block">
          <div role="row" className="flex items-center gap-1">
            <div className="w-24 shrink-0" />
            {cells.map((_, colIndex) => (
              <div
                key={colIndex}
                role="columnheader"
                aria-label={`Langkah ${colIndex + 1}`}
                className="w-9 shrink-0 text-center text-xs text-gray-400"
              >
                {colIndex + 1}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAppend}
              disabled={disabled}
              title="Tambah langkah di akhir"
              className="ml-1 h-8 w-8 shrink-0 rounded border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 disabled:opacity-40 cursor-pointer"
            >
              +
            </button>
          </div>

          {slots.map((slot, rowIndex) => (
            <div key={slot.id} role="row" className="mt-1 flex items-center gap-1">
              <div className="w-24 shrink-0 pr-2 text-right">
                <span className="text-xs font-medium text-gray-900">{slot.label}</span>{' '}
                <span className="font-mono text-xs text-gray-400">{slot.key}</span>
              </div>
              {cells.map((cell, colIndex) => {
                const active = cell === slot.key;
                return (
                  <div key={colIndex} role="gridcell" className="shrink-0">
                    <button
                      type="button"
                      aria-pressed={active}
                      aria-label={`Langkah ${colIndex + 1}, ${slot.label} (${slot.key})`}
                      disabled={disabled}
                      onClick={() => handleCellClick(slot.key, colIndex)}
                      className={[
                        'h-8 w-9 rounded border text-xs font-mono transition-colors cursor-pointer',
                        active
                          ? `${rowTones[rowIndex % rowTones.length]} border-transparent`
                          : 'border-gray-200 bg-white text-gray-300 hover:border-gray-400 hover:text-gray-500',
                        disabled ? 'cursor-not-allowed opacity-60' : '',
                      ].join(' ')}
                    >
                      {slot.key}
                    </button>
                  </div>
                );
              })}
              <div className="ml-1 h-8 w-8 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
