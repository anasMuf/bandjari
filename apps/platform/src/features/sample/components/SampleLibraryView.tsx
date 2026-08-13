import { useState } from 'react';
import {
  useGetSamples,
  usePostSamples,
  usePutSamplesId,
  useDeleteSamplesId,
  getSamplesIdPlaybackUrl,
} from '../../../api/endpoints/samples/samples';
import type { DtoSuccessResponse } from '../../../api/model';
import { Button } from '../../../components/atoms/Button';
import { FormField } from '../../../components/molecules/FormField';
import { ConfirmDialog } from '../../../components/molecules/ConfirmDialog';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';

interface SampleItem {
  id: number;
  name: string;
  part: string;
  file_size_bytes: number;
  is_system_template: boolean;
}

const PARTS = ['rebana1', 'rebana2', 'rebana3', 'rebana4', 'bass'] as const;

export function SampleLibraryView() {
  const { addToast } = useToast();
  const [partFilter, setPartFilter] = useState('');
  const samplesQuery = useGetSamples(partFilter ? { part: partFilter } : undefined);
  const uploadMutation = usePostSamples();
  const renameMutation = usePutSamplesId();
  const deleteMutation = useDeleteSamplesId();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadPart, setUploadPart] = useState<string>(PARTS[0]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [renaming, setRenaming] = useState<SampleItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<SampleItem | null>(null);

  const notify = (title: string, message: string) =>
    addToast({ variant: 'success', title, message });
  const showError = (error: unknown, title: string) =>
    addToast({
      variant: 'error',
      title,
      message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
    });

  const samples = ((samplesQuery.data?.data as DtoSuccessResponse | undefined)?.data ??
    []) as SampleItem[];

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    uploadMutation.mutate(
      { data: { file: uploadFile, name: uploadName.trim(), part: uploadPart } },
      {
        onSuccess: () => {
          notify('Sample diunggah', 'File audio berhasil disimpan ke library Anda.');
          setUploadOpen(false);
          setUploadName('');
          setUploadFile(null);
          samplesQuery.refetch();
        },
        onError: (error) => showError(error, 'Gagal mengunggah sample'),
      },
    );
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
          samplesQuery.refetch();
        },
        onError: (error) => showError(error, 'Gagal mengubah nama'),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          notify('Sample dihapus', 'File audio dihapus dari library.');
          setDeleting(null);
          samplesQuery.refetch();
        },
        onError: (error) => showError(error, 'Gagal menghapus sample'),
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Sample Audio</h2>
          <p className="mt-1 text-sm text-gray-500">
            Kelola file audio pukulan rebana milik Anda (format .wav, maks 5MB).
          </p>
        </div>
        <Button type="button" onClick={() => setUploadOpen(!uploadOpen)}>
          + Unggah Sample
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-gray-500">Filter Part:</span>
        <select
          value={partFilter}
          onChange={(e) => setPartFilter(e.target.value)}
          className="rounded-md border-gray-300 bg-white text-sm shadow-xs"
        >
          <option value="">Semua</option>
          {PARTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {uploadOpen && (
        <form
          onSubmit={handleUpload}
          className="mt-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-900/5"
        >
          <h3 className="text-sm font-semibold text-gray-900">Unggah Sample Baru</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              id="upload-name"
              name="upload-name"
              type="text"
              label="Nama sample"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              required
              maxLength={255}
            />
            <div>
              <label htmlFor="upload-part" className="block text-sm/6 font-medium text-gray-900">
                Part
              </label>
              <select
                id="upload-part"
                value={uploadPart}
                onChange={(e) => setUploadPart(e.target.value)}
                className="mt-2 block w-full rounded-md border-gray-300 bg-white text-sm shadow-xs"
              >
                {PARTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="upload-file" className="block text-sm/6 font-medium text-gray-900">
                File .wav (maks 5MB)
              </label>
              <input
                id="upload-file"
                type="file"
                accept=".wav,audio/wav,audio/x-wav"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={uploadMutation.isPending || !uploadFile}>
              Unggah
            </Button>
            <Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>
              Batal
            </Button>
          </div>
        </form>
      )}

      {renaming && (
        <form
          onSubmit={handleRename}
          className="mt-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-900/5"
        >
          <h3 className="text-sm font-semibold text-gray-900">
            Ganti nama: {renaming.name}
          </h3>
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
            <Button type="button" variant="secondary" onClick={() => setRenaming(null)}>
              Batal
            </Button>
          </div>
        </form>
      )}

      {samplesQuery.isLoading ? (
        <p className="mt-6 text-sm text-gray-500">Memuat library sample...</p>
      ) : samples.length === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm font-medium text-gray-900">Belum ada sample</p>
          <p className="mt-1 text-sm text-gray-500">
            Unggah rekaman pukulan rebana Anda untuk mulai menyusun pola.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          {samples.map((sample) => (
            <li key={sample.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{sample.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {sample.part} · {Math.round(sample.file_size_bytes / 1024)} KB
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePreview(sample)}
                >
                  ▶
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRenaming(sample);
                    setRenameValue(sample.name);
                  }}
                >
                  Rename
                </Button>
                <Button type="button" variant="danger" size="sm" onClick={() => setDeleting(sample)}>
                  Hapus
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
