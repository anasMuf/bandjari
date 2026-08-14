import { useState } from 'react';
import {
  useGetSamples,
  useGetSamplesTemplates,
  usePostSamples,
  usePutSamplesId,
  useDeleteSamplesId,
  getSamplesIdPlaybackUrl,
} from '../../../api/endpoints/samples/samples';
import type { DtoSuccessResponse } from '../../../api/model';
import { Button } from '../../../components/atoms/Button';
import { Badge } from '../../../components/atoms/Badge';
import { FormField } from '../../../components/molecules/FormField';
import { ConfirmDialog } from '../../../components/molecules/ConfirmDialog';
import { PageHeader } from '../../../components/molecules/PageHeader';
import { SectionHeader } from '../../../components/molecules/SectionHeader';
import { EmptyState } from '../../../components/molecules/EmptyState';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';
import { useAuth } from '../../auth/AuthContext';
import { PART_LABELS } from '../../sequencer/utils/parts';
import { sampleNameFromFileName } from '../sample-name';

interface SampleItem {
  id: number;
  name: string;
  part: string;
  file_size_bytes: number;
  is_system_template: boolean;
  usage_count?: number;
}

const PARTS = ['rebana1', 'rebana2', 'rebana3', 'rebana4', 'bass'] as const;

function partLabel(part: string): string {
  return PART_LABELS[part] ?? part;
}

export function SampleLibraryView() {
  const { addToast } = useToast();
  const { isAdmin } = useAuth();
  const [partFilter, setPartFilter] = useState('');
  const samplesQuery = useGetSamples(partFilter ? { part: partFilter } : undefined);
  const templatesQuery = useGetSamplesTemplates(partFilter ? { part: partFilter } : undefined);
  const uploadMutation = usePostSamples();
  const renameMutation = usePutSamplesId();
  const deleteMutation = useDeleteSamplesId();

  const [uploadOpen, setUploadOpen] = useState(false);
  // Satu baris per file: nama prefill dari nama file (tetap bisa diedit) + Part per file.
  const [pending, setPending] = useState<Array<{ file: File; name: string; part: string }>>([]);
  // Admin: seluruh batch diunggah sebagai Sample Template System (FR-ROLE).
  const [asTemplate, setAsTemplate] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [renaming, setRenaming] = useState<SampleItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<SampleItem | null>(null);
  // State error 409 (FR-SAMP-08/AC-6): sample masih direferensikan SoundSlot.
  const [deleteConflict, setDeleteConflict] = useState<{ name: string; message: string } | null>(null);

  const notify = (title: string, message: string) =>
    addToast({ variant: 'success', title, message });
  const showError = (error: unknown, title: string) =>
    addToast({
      variant: 'error',
      title,
      message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
    });

  const mine = ((samplesQuery.data?.data as DtoSuccessResponse | undefined)?.data ??
    []) as SampleItem[];
  const templates = ((templatesQuery.data?.data as DtoSuccessResponse | undefined)?.data ??
    []) as SampleItem[];

  const refreshAll = () => {
    samplesQuery.refetch();
    templatesQuery.refetch();
  };

  // Bulk upload: nama tiap sample di-prefill dari nama file (tetap bisa diedit),
  // Part dipilih per file. File diunggah berurutan; file yang gagal (bukan .wav
  // / >5MB) dilaporkan tanpa menghentikan sisanya.
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.length === 0) return;
    setUploadProgress({ done: 0, total: pending.length });
    let ok = 0;
    const failed: string[] = [];
    for (const item of pending) {
      const name = item.name.trim() || sampleNameFromFileName(item.file.name);
      try {
        await uploadMutation.mutateAsync({
          data: {
            file: item.file,
            name,
            part: item.part,
            is_system_template: asTemplate || undefined,
          },
        });
        ok++;
      } catch (error) {
        failed.push(
          `${item.file.name}: ${error instanceof ApiError ? error.message : 'gagal diunggah'}`,
        );
      }
      setUploadProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
    }

    if (failed.length === 0) {
      notify(
        'Sample diunggah',
        asTemplate
          ? `${ok} file berhasil disimpan sebagai Sample Template System.`
          : `${ok} file berhasil disimpan sebagai Sample Saya.`,
      );
    } else {
      addToast({
        variant: 'error',
        title: `${failed.length} dari ${pending.length} file gagal`,
        message: `${ok} berhasil. ${failed.join('; ')}`,
      });
    }
    setUploadProgress(null);
    setPending([]);
    refreshAll();
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming) return;
    renameMutation.mutate(
      { id: renaming.id, data: { name: renameValue.trim() } },
      {
        onSuccess: () => {
          notify('Nama diperbarui', 'Perubahan tersimpan.');
          setRenaming(null);
          refreshAll();
        },
        onError: (error) => showError(error, 'Gagal mengubah nama'),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    setDeleteConflict(null);
    deleteMutation.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          notify('Sample dihapus', 'File audio dihapus dari library.');
          setDeleting(null);
          refreshAll();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            // FR-SAMP-08/AC-6: tolak hapus yang masih direferensikan — tampilkan
            // kotak error inline yang memandu melepas referensi di Sequencer.
            setDeleteConflict({ name: deleting.name, message: error.message });
            setDeleting(null);
          } else {
            showError(error, 'Gagal menghapus sample');
          }
        },
      },
    );
  };

  const handlePreview = async (sample: SampleItem) => {
    try {
      const response = await getSamplesIdPlaybackUrl(sample.id);
      const data = response.data as DtoSuccessResponse;
      const url = (data.data as { url: string })?.url;
      if (url) {
        new Audio(url).play().catch(() => {
          addToast({ variant: 'error', title: 'Gagal memutar', message: 'Audio tidak dapat diputar.' });
        });
      }
    } catch (error) {
      showError(error, 'Gagal mengambil URL playback');
    }
  };

  return (
    <div>
      <PageHeader
        title="Library Sample"
        subtitle="Reusable lintas Song, Section & SoundSlot — format .wav, maks 5MB."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-stone-500">
              Filter Part
              <select
                value={partFilter}
                onChange={(e) => setPartFilter(e.target.value)}
                className="rounded-md border-0 bg-white py-1.5 pl-3 pr-8 text-sm text-stone-900 ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-brand-700"
              >
                <option value="">Semua Part</option>
                {PARTS.map((p) => (
                  <option key={p} value={p}>
                    {partLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" onClick={() => setUploadOpen(!uploadOpen)}>
              + Upload Sample
            </Button>
          </>
        }
      />

      <p className="mt-4 rounded-md border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600">
        <span className="font-semibold text-stone-800">Catatan:</span> Sample tidak lagi terikat pada
        satu jenis bunyi tetap — kini sebuah Sample hanya terikat ke Part, dan bisa dipasangkan ke
        SoundSlot manapun (Tak, Dung, Duk, atau nama lain) saat digunakan di Sequencer Mode.
      </p>

      {uploadOpen && (
        <form onSubmit={handleUpload} className="mt-4 rounded-lg bg-white p-4 ring-1 ring-stone-900/5">
          <h2 className="text-sm font-semibold text-stone-900">Upload Sample Baru (bulk)</h2>

          <div className="mt-4">
            <label htmlFor="upload-file" className="block text-sm/6 font-medium text-stone-900">
              File (.wav, maks 5MB tiap file — bisa pilih banyak)
            </label>
            <input
              id="upload-file"
              type="file"
              multiple
              accept=".wav,audio/wav,audio/x-wav"
              onChange={(e) =>
                setPending(
                  Array.from(e.target.files ?? []).map((file) => ({
                    file,
                    name: sampleNameFromFileName(file.name),
                    part: PARTS[0],
                  })),
                )
              }
              className="mt-2 block w-full text-sm text-stone-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100"
            />
          </div>

          {pending.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-stone-700">
                {pending.length} file dipilih — nama & Part bisa disesuaikan per file sebelum unggah:
              </p>
              <ul className="mt-2 divide-y divide-stone-100 rounded-md ring-1 ring-stone-200 ring-inset">
                {pending.map((item, index) => (
                  <li key={`${item.file.name}-${item.file.size}`} className="flex flex-wrap items-end gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-stone-400" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <label
                        htmlFor={`upload-name-${index}`}
                        className="mt-1 block text-xs font-medium text-stone-600"
                      >
                        Nama sample
                      </label>
                      <input
                        id={`upload-name-${index}`}
                        value={item.name}
                        onChange={(e) =>
                          setPending((prev) =>
                            prev.map((p, i) => (i === index ? { ...p, name: e.target.value } : p)),
                          )
                        }
                        maxLength={255}
                        className="mt-1 block w-full rounded-md bg-white px-3 py-1.5 text-sm text-stone-900 outline-1 -outline-offset-1 outline-stone-300 placeholder:text-stone-400 focus:outline-2 focus:-outline-offset-2 focus:outline-brand-700"
                      />
                    </div>
                    <div className="w-36 shrink-0">
                      <label
                        htmlFor={`upload-part-${index}`}
                        className="block text-xs font-medium text-stone-600"
                      >
                        Part
                      </label>
                      <select
                        id={`upload-part-${index}`}
                        value={item.part}
                        onChange={(e) =>
                          setPending((prev) =>
                            prev.map((p, i) => (i === index ? { ...p, part: e.target.value } : p)),
                          )
                        }
                        className="mt-1 block w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-8 text-sm text-stone-900 ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-brand-700"
                      >
                        {PARTS.map((p) => (
                          <option key={p} value={p}>
                            {partLabel(p)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-2 text-xs text-stone-500">
            Jenis bunyi (Tak/Dung/Duk/dst) tidak ditentukan di sini — akan dipilih saat Sample ini
            dipasangkan ke sebuah SoundSlot di Sequencer Mode.
          </p>
          {isAdmin && (
            <label className="mt-3 flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={asTemplate}
                onChange={(e) => setAsTemplate(e.target.checked)}
                className="size-4 rounded border-stone-300 accent-brand-700"
              />
              Unggah sebagai Sample Template System (bawaan platform — hanya admin yang bisa mengelola)
            </label>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              disabled={pending.length === 0 || uploadProgress !== null}
            >
              {uploadProgress
                ? `Mengunggah ${uploadProgress.done}/${uploadProgress.total}…`
                : `Unggah ${pending.length > 0 ? `${pending.length} File` : ''}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setUploadOpen(false);
                setPending([]);
                setAsTemplate(false);
              }}
              disabled={uploadProgress !== null}
            >
              Batal
            </Button>
          </div>
        </form>
      )}

      {renaming && (
        <form onSubmit={handleRename} className="mt-4 rounded-lg bg-white p-4 ring-1 ring-stone-900/5">
          <h2 className="text-sm font-semibold text-stone-900">Ubah Nama: {renaming.name}</h2>
          <div className="mt-3 max-w-sm">
            <FormField
              id="rename-value"
              name="rename-value"
              type="text"
              label="Nama baru"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              required
              maxLength={255}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={renameMutation.isPending}>
              Simpan
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
              Batal
            </Button>
          </div>
        </form>
      )}

      {/* Seksi 1: Sample Bawaan (Template System) — read-only */}
      <section aria-label="Sample bawaan" className="mt-8">
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              <Badge>SYSTEM</Badge>
              Sample Bawaan (Template System)
            </span>
          }
          subtitle={
            isAdmin
              ? 'Disediakan platform, tersedia untuk semua pengguna. Sebagai admin, kamu bisa mengubah nama & menghapus sample bawaan.'
              : 'Disediakan platform, tersedia untuk semua pengguna. Read-only — tidak bisa diedit/dihapus.'
          }
        />

        {templatesQuery.isLoading ? (
          <p className="mt-4 text-sm text-stone-500">Memuat sample bawaan...</p>
        ) : templates.length === 0 ? (
          <EmptyState
            icon="♪"
            title="Belum ada sample bawaan"
            description="Tim platform sedang menyiapkan sample bawaan untuk kelima Part."
          />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((sample) => (
              <article key={sample.id} className="rounded-lg bg-white p-4 ring-1 ring-stone-900/5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate text-sm font-medium text-stone-900">{sample.name}</h3>
                  <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                    {partLabel(sample.part)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Dipakai di {sample.usage_count ?? 0} SoundSlot
                  {(sample.usage_count ?? 0) > 1 ? ' (reuse)' : ''}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => handlePreview(sample)}>
                    ▶ Preview
                  </Button>
                  {isAdmin && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRenaming(sample);
                          setRenameValue(sample.name);
                        }}
                      >
                        Ubah Nama
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleting(sample)}
                      >
                        Hapus
                      </Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Seksi 2: Sample Saya */}
      <section aria-label="Sample saya" className="mt-8">
        <SectionHeader
          title="Sample Saya"
          subtitle="Upload milikmu sendiri — bisa diedit atau dihapus (selama tidak sedang dipakai)."
        />

        {deleteConflict && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-300 bg-red-50 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-red-800">
                  ✕ Tidak dapat menghapus “{deleteConflict.name}”
                </p>
                <p className="mt-1 text-xs text-red-700">
                  {deleteConflict.message}. Lepas referensinya dulu di Sequencer Mode sebelum
                  menghapus (FR-SAMP-10).
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup pesan error"
                onClick={() => setDeleteConflict(null)}
                className="rounded p-1 text-red-400 hover:bg-red-100 hover:text-red-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {samplesQuery.isLoading ? (
          <p className="mt-4 text-sm text-stone-500">Memuat sample milikmu...</p>
        ) : mine.length === 0 ? (
          <EmptyState
            icon="♪"
            title="Belum ada sample milikmu"
            description="Unggah rekaman pukulan rebana Anda untuk mulai menyusun pola."
          >
            <Button type="button" onClick={() => setUploadOpen(true)}>
              + Upload Sample
            </Button>
          </EmptyState>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((sample) => (
              <article key={sample.id} className="rounded-lg bg-white p-4 ring-1 ring-stone-900/5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate text-sm font-medium text-stone-900">{sample.name}</h3>
                  <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                    {partLabel(sample.part)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Dipakai di {sample.usage_count ?? 0} SoundSlot
                  {(sample.usage_count ?? 0) > 1 ? ' (reuse)' : ''} ·{' '}
                  {Math.round(sample.file_size_bytes / 1024)} KB
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => handlePreview(sample)}>
                    ▶ Preview
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRenaming(sample);
                      setRenameValue(sample.name);
                    }}
                  >
                    Ubah Nama
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => setDeleting(sample)}>
                    Hapus
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!deleting}
        title="Hapus sample"
        description={`Yakin menghapus "${deleting?.name}"? Sample yang masih dipakai SoundSlot tidak dapat dihapus.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
