import { useState } from 'react';
import {
  usePostSongsSongIdSections,
  usePutSectionsIdReorder,
} from '../../../api/endpoints/sections/sections';
import { Button } from '../../../components/atoms/Button';
import { Badge } from '../../../components/atoms/Badge';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';

export interface SectionItem {
  id: number;
  song_id: number;
  name: string;
  order_index: number;
  bpm_override: number | null;
}

interface SectionStripProps {
  songId: number;
  songBpm: number;
  sections: SectionItem[];
  selectedId: number | null;
  onSelect: (section: SectionItem) => void;
  onChanged: () => void;
  /** Mode lihat-saja (Guest / Song Template): aksi edit memicu onEditAttempt. */
  readOnly?: boolean;
  onEditAttempt?: () => void;
}

/**
 * Strip chip Section (layar 2 wireframe): pegangan #N + nama + BPM badge (★ untuk
 * override) + chip "Tambah Section". Urutan menentukan susunan pad Launcher.
 */
export function SectionStrip({
  songId,
  songBpm,
  sections,
  selectedId,
  onSelect,
  onChanged,
  readOnly = false,
  onEditAttempt,
}: SectionStripProps) {
  const { addToast } = useToast();
  const createMutation = usePostSongsSongIdSections();
  const reorderMutation = usePutSectionsIdReorder();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [dragged, setDragged] = useState<SectionItem | null>(null);

  const sorted = [...sections].sort((a, b) => a.order_index - b.order_index);

  const showError = (error: unknown, title: string) =>
    addToast({
      variant: 'error',
      title,
      message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
    });

  const guardEdit = (): boolean => {
    if (readOnly) {
      onEditAttempt?.();
      return false;
    }
    return true;
  };

  const startAdd = () => {
    if (!guardEdit()) return;
    setAdding(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate(
      { songId, data: { name: newName.trim() } },
      {
        onSuccess: () => {
          addToast({
            variant: 'success',
            title: 'Section dibuat',
            message: '5 bagian instrumen otomatis disiapkan di baliknya.',
          });
          setNewName('');
          setAdding(false);
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal menambah section'),
      },
    );
  };

  const move = (sec: SectionItem, newIndex: number) => {
    if (readOnly) {
      onEditAttempt?.();
      return;
    }
    reorderMutation.mutate(
      { id: sec.id, data: { order_index: newIndex } },
      {
        onSuccess: () => onChanged(),
        onError: (error) => showError(error, 'Gagal mengubah urutan section'),
      },
    );
  };

  const handleDrop = (target: SectionItem) => {
    if (dragged && dragged.id !== target.id) {
      move(dragged, sorted.findIndex((s) => s.id === target.id));
    }
    setDragged(null);
  };

  return (
    <section aria-label="Section" className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">Section</h2>
        <span className="text-xs text-stone-500">
          {readOnly ? 'Urutan menentukan susunan pad Launcher' : 'Seret ⠿ untuk mengatur ulang urutan'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {sorted.map((sec, index) => {
          const active = sec.id === selectedId;
          const override = sec.bpm_override !== null;
          return (
            // biome-ignore lint/a11y/useSemanticElements: chip berisi tombol ▲/▼ bersarang — elemen <button> di dalamnya tidak valid
            <div
              key={sec.id}
              draggable={!readOnly}
              onDragStart={() => setDragged(sec)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(sec)}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => onSelect(sec)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(sec);
                }
              }}
              className={[
                'flex select-none items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                active
                  ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700/30 ring-inset'
                  : 'border-stone-200 bg-white hover:border-stone-300',
                readOnly ? 'cursor-default' : 'cursor-grab',
              ].join(' ')}
            >
              <span className="flex items-center gap-1 text-xs text-stone-400" aria-hidden="true">
                <span>⠿</span>
                <span className={active ? 'font-semibold text-brand-800' : ''}>#{index + 1}</span>
              </span>
              <span className={`font-medium ${active ? 'text-brand-900' : 'text-stone-900'}`}>
                {sec.name}
              </span>
              {override ? (
                <span className="flex items-center gap-1">
                  <Badge variant="star">★</Badge>
                  <span className="text-xs font-semibold text-amber-700">{sec.bpm_override} BPM</span>
                </span>
              ) : (
                <span className="text-xs text-stone-500">{songBpm} BPM</span>
              )}
              {!readOnly && (
                <span className="ml-1 flex items-center gap-0.5">
                  <button
                    type="button"
                    title="Naikkan urutan"
                    aria-label={`Naikkan urutan ${sec.name}`}
                    className="rounded px-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      move(sec, Math.max(0, sec.order_index - 1));
                    }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    title="Turunkan urutan"
                    aria-label={`Turunkan urutan ${sec.name}`}
                    className="rounded px-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      move(sec, sec.order_index + 1);
                    }}
                  >
                    ▼
                  </button>
                </span>
              )}
            </div>
          );
        })}

        {adding ? (
          <form onSubmit={handleCreate} className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="mis. Awalan"
              required
              maxLength={255}
              aria-label="Nama section baru"
              className="block w-40 rounded-md border-0 px-3 py-1.5 text-sm text-stone-900 outline-1 -outline-offset-1 outline-stone-300 placeholder:text-stone-400 focus:outline-2 focus:-outline-offset-2 focus:outline-brand-700"
            />
            <Button type="submit" size="sm" disabled={createMutation.isPending}>
              Simpan
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Batal
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={startAdd}
            className="rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500 transition-colors hover:border-brand-700 hover:text-brand-700 cursor-pointer"
          >
            + Tambah Section
          </button>
        )}
      </div>

      {sections.length === 0 && !adding && (
        <p className="mt-2 text-sm text-stone-400">Belum ada section — tambahkan yang pertama.</p>
      )}
    </section>
  );
}
