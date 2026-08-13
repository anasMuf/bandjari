import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useGetSongsTemplates, usePostSongsIdDuplicate } from '../../../api/endpoints/songs/songs';
import type { DtoSuccessResponse } from '../../../api/model';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { ApiError } from '../../../api/mutator/custom-instance';
import { useAuth } from '../../auth/AuthContext';
import { LoginPromptInline } from '../../auth/components/LoginPromptInline';

interface TemplateSong {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
}

/**
 * Daftar Song Template System — dapat diakses Guest (demo tanpa login, AC-11)
 * maupun User login (dengan aksi "Duplikasi ke Song Saya", FR-SONG-10).
 */
export function SongTemplateList() {
  const { addToast } = useToast();
  const { isAuthenticated } = useAuth();
  const templatesQuery = useGetSongsTemplates();
  const duplicateMutation = usePostSongsIdDuplicate();

  const [promptFor, setPromptFor] = useState<number | null>(null);

  const templates = ((templatesQuery.data?.data as DtoSuccessResponse | undefined)?.data ??
    []) as TemplateSong[];

  const handleDuplicate = (song: TemplateSong) => {
    if (!isAuthenticated) {
      setPromptFor(song.id);
      return;
    }
    duplicateMutation.mutate(
      { id: song.id },
      {
        onSuccess: () => {
          addToast({
            variant: 'success',
            title: 'Lagu diduplikasi',
            message: 'Salinan tersimpan di "Lagu Saya" — bebas dimodifikasi.',
          });
        },
        onError: (error) => {
          addToast({
            variant: 'error',
            title: 'Gagal menduplikasi',
            message: error instanceof ApiError ? error.message : 'Terjadi kesalahan tak terduga.',
          });
        },
      },
    );
  };

  if (templatesQuery.isLoading) {
    return <p className="text-sm text-gray-500">Memuat lagu bawaan...</p>;
  }

  return (
    <section aria-label="Lagu bawaan" className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Lagu Bawaan</h2>
        <span className="text-xs text-gray-500">Susunan standar Al-Banjari, siap dimainkan</span>
      </div>

      {templates.length === 0 ? (
        <p role="status" className="mt-4 rounded-md bg-gray-50 p-4 text-sm text-gray-500">
          Belum ada lagu bawaan. Tim platform sedang menyiapkannya.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          {templates.map((song) => (
            <li key={song.id} className="px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{song.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{song.bpm} BPM dasar</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/songs/$songId"
                    params={{ songId: String(song.id) }}
                    className="inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-gray-300 ring-inset transition-colors hover:bg-gray-50"
                  >
                    Buka
                  </Link>
                  <Button
                    type="button"
                    size="md"
                    onClick={() => handleDuplicate(song)}
                    disabled={duplicateMutation.isPending}
                  >
                    Duplikasi ke Song Saya
                  </Button>
                </div>
              </div>
              {promptFor === song.id && !isAuthenticated && (
                <LoginPromptInline action="menduplikasi lagu" onDismiss={() => setPromptFor(null)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
