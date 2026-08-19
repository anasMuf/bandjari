import { useState } from 'react';
import { X } from 'lucide-react';
import {
  usePostSectionPartsIdSoundSlots,
  usePutSoundSlotsId,
  useDeleteSoundSlotsId,
} from '../../../api/endpoints/sound-slots/sound-slots';
import { Button } from '../../../components/atoms/Button';
import { ConfirmDialog } from '../../../components/molecules/ConfirmDialog';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';
import { SamplePicker } from './SamplePicker';

export interface SoundSlotData {
  id: number;
  section_part_id: number;
  label: string;
  key: string;
  sample_id: number | null;
  order_index: number;
}

interface SoundSlotManagerProps {
  partId: number;
  /** Nama tampilan Part (mis. "Rebana 1") — dipakai di judul panel. */
  partLabel: string;
  slots: SoundSlotData[];
  onChanged: () => void;
  /** Drawer kelola bunyi terbuka? */
  open: boolean;
  /** Tutup drawer. */
  onClose: () => void;
  /** Mode lihat-saja: aksi edit memicu onEditAttempt (AC-12), bukan perubahan. */
  readOnly?: boolean;
  onEditAttempt?: () => void;
}

const emptyForm = { label: '', key: '' };

/**
 * Pengelola jenis bunyi (SoundSlot) untuk satu SectionPart: tambah, ubah
 * label/key, pasang sample (dua kelompok: Bawaan & Sample Saya — FR-SAMP-14),
 * hapus — dengan pesan error yang mengarahkan user membersihkan steps saat
 * key masih dipakai (FR-SLOT-05/06).
 */
export function SoundSlotManager({
  partId,
  partLabel,
  slots,
  onChanged,
  open,
  onClose,
  readOnly = false,
  onEditAttempt,
}: SoundSlotManagerProps) {
  const { addToast } = useToast();
  const createMutation = usePostSectionPartsIdSoundSlots();
  const updateMutation = usePutSoundSlotsId();
  const deleteMutation = useDeleteSoundSlotsId();

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<SoundSlotData | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState<SoundSlotData | null>(null);

  const guardEdit = (): boolean => {
    if (readOnly) {
      onEditAttempt?.();
      return false;
    }
    return true;
  };

  const showError = (error: unknown, title: string) => {
    addToast({
      variant: 'error',
      title,
      message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardEdit()) return;
    createMutation.mutate(
      { id: partId, data: { label: form.label.trim(), key: form.key } },
      {
        onSuccess: () => {
          addToast({ variant: 'success', title: 'Jenis bunyi ditambahkan', message: 'Gunakan key ini di grid steps.' });
          setForm(emptyForm);
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal menambah jenis bunyi'),
      },
    );
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    updateMutation.mutate(
      { id: editing.id, data: { label: editForm.label.trim(), key: editForm.key } },
      {
        onSuccess: () => {
          addToast({ variant: 'success', title: 'Jenis bunyi diperbarui', message: 'Perubahan tersimpan.' });
          setEditing(null);
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal memperbarui jenis bunyi'),
      },
    );
  };

  const handleSampleChange = (slot: SoundSlotData, sampleId: number | null) => {
    if (!guardEdit()) return;
    updateMutation.mutate(
      { id: slot.id, data: { sample_id: { set: true, value: sampleId ?? undefined } } },
      {
        onSuccess: () => onChanged(),
        onError: (error) => showError(error, 'Gagal mengubah sample'),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          addToast({ variant: 'success', title: 'Jenis bunyi dihapus', message: 'Key tidak lagi tersedia di steps.' });
          setDeleting(null);
          onChanged();
        },
        onError: (error) => showError(error, 'Gagal menghapus jenis bunyi'),
      },
    );
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop — mobile only (desktop: panel sisi tanpa backdrop, pola LauncherQueue). */}
      <div className="fixed inset-0 z-30 bg-stone-900/40 sm:hidden" onClick={onClose} aria-hidden="true" />

      <section
        aria-label={`Jenis bunyi ${partLabel}`}
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[70vh] flex-col rounded-t-2xl bg-white shadow-2xl ring-1 ring-stone-900/10 max-sm:animate-[slideUp_180ms_ease-out] sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-96 sm:rounded-none sm:rounded-l-2xl sm:animate-[slideIn_180ms_ease-out]"
      >
        {/* Header drawer */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-stone-900">Jenis Bunyi (SoundSlot) — {partLabel}</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Setiap jenis bunyi punya label, key 1–2 karakter (dipakai di steps), dan satu sample.
              Bunyi tanpa sample akan senyap saat dimainkan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kelola bunyi"
            className="shrink-0 rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Konten scrollable */}
        <div className="overflow-y-auto p-5">

      <ul className="mt-3 divide-y divide-stone-100 rounded-md ring-1 ring-stone-200 ring-inset">
        {slots.map((slot) =>
          editing?.id === slot.id ? (
            <li key={slot.id} className="px-4 py-3">
              <form onSubmit={handleUpdate} className="flex flex-wrap items-end gap-3">
                <div className="min-w-40 flex-1">
                  <label htmlFor={`edit-label-${slot.id}`} className="block text-sm/6 font-medium text-stone-900">
                    Label
                  </label>
                  <input
                    id={`edit-label-${slot.id}`}
                    value={editForm.label}
                    onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                    required
                    maxLength={64}
                    className="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-sm text-stone-900 ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-brand-700"
                  />
                </div>
                <div className="w-20">
                  <label htmlFor={`edit-key-${slot.id}`} className="block text-sm/6 font-medium text-stone-900">
                    Key
                  </label>
                  <input
                    id={`edit-key-${slot.id}`}
                    value={editForm.key}
                    onChange={(e) => setEditForm({ ...editForm, key: e.target.value.slice(0, 2) })}
                    required
                    maxLength={2}
                    className="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-sm text-stone-900 ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-brand-700"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                    Simpan
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(null)}>
                    Batal
                  </Button>
                </div>
              </form>
            </li>
          ) : (
            <li key={slot.id} className="flex flex-wrap items-end gap-4 px-4 py-3">
              <div className="min-w-32">
                <p className="text-sm font-medium text-stone-900">{slot.label}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  Key: <span className="font-mono font-semibold text-stone-700">{slot.key}</span>
                </p>
              </div>
              <div className="min-w-56 flex-1">
                <SamplePicker
                  id={`slot-sample-${slot.id}`}
                  label="Sample"
                  value={slot.sample_id}
                  onChange={(sampleId) => handleSampleChange(slot, sampleId)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (!guardEdit()) return;
                    setEditing(slot);
                    setEditForm({ label: slot.label, key: slot.key });
                  }}
                >
                  Ubah label/key
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={() => guardEdit() && setDeleting(slot)}>
                  Hapus
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>

      <form onSubmit={handleCreate} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <label htmlFor="new-slot-label" className="block text-sm/6 font-medium text-stone-900">
            Label bunyi baru
          </label>
          <input
            id="new-slot-label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="mis. Duk"
            required
            maxLength={64}
            className="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-sm text-stone-900 ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-brand-700"
          />
        </div>
        <div className="w-20">
          <label htmlFor="new-slot-key" className="block text-sm/6 font-medium text-stone-900">
            Key
          </label>
          <input
            id="new-slot-key"
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value.slice(0, 2) })}
            placeholder="K"
            required
            maxLength={2}
            className="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-sm text-stone-900 ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-brand-700"
          />
        </div>
        <Button type="submit" size="sm" disabled={createMutation.isPending}>
          + Tambah Bunyi
        </Button>
      </form>

      {readOnly && (
        <p className="mt-2 text-xs text-stone-400">
          Mode lihat-saja — masuk untuk mengubah jenis bunyi.
        </p>
      )}
        </div>
      </section>

      <ConfirmDialog
        open={!!deleting}
        title="Hapus jenis bunyi"
        description={`Hapus "${deleting?.label}" (key ${deleting?.key})? Bunyi yang key-nya masih dipakai di steps tidak dapat dihapus.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
