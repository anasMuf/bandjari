import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useGetSongsId } from '../api/endpoints/songs/songs'
import { useAuth } from '../features/auth/AuthContext'
import { LoginPromptInline } from '../features/auth/components/LoginPromptInline'
import { PageHeader } from '../components/molecules/PageHeader'
import { LauncherGrid } from '../features/launcher/components/LauncherGrid'
import {
  useLauncherPlayback,
  type LauncherSection,
} from '../features/launcher/hooks/useLauncherPlayback'

export const Route = createFileRoute('/songs/$songId/play')({
  component: LauncherPage,
})

interface SongDetail {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
  sections?: LauncherSection[];
}

/**
 * Launcher Mode (layar 5 wireframe) — mode pemutaran live (clip launcher).
 * Dapat diakses Guest untuk Song Template System (AC-11) dan pemilik Song.
 */
function LauncherPage() {
  const { songId } = Route.useParams()
  const id = Number(songId)
  const songQuery = useGetSongsId(id)
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [showPrompt, setShowPrompt] = useState(false)
  const resp = songQuery.data?.data;
  const song = resp && 'data' in resp ? (resp.data as SongDetail) : undefined;

  const playback = useLauncherPlayback(song?.bpm ?? 90);
  const { prepare, ready } = playback;

  useEffect(() => {
    if (song?.sections && !ready) {
      void prepare(song.sections);
    }
  }, [song, ready, prepare]);

  if (songQuery.isLoading) {
    return <p className="text-sm text-stone-500">Memuat lagu...</p>;
  }

  if (songQuery.isError || !song) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          {isAuthenticated ? (
            <>
              <p className="text-sm font-medium text-red-800">Lagu tidak ditemukan atau tidak dapat diakses.</p>
              <Link to="/songs" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:text-brand-600">
                Kembali ke daftar lagu
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-red-800">Lagu ini milik pengguna lain.</p>
              <p className="mt-1 text-xs text-red-700">
                Lagu pribadi hanya bisa diakses pemiliknya. Masuk untuk membuka lagu Anda, atau
                jelajahi lagu bawaan.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                >
                  Masuk
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 ring-1 ring-stone-300 ring-inset hover:bg-stone-50"
                >
                  Lihat lagu bawaan
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const backTo = isAuthenticated && !song.is_system_template ? '/songs/$songId' : '/templates/$songId';

  const handleAddSection = () => {
    if (isAuthenticated && !song.is_system_template) {
      navigate({ to: '/songs/$songId', params: { songId: String(id) } });
      return;
    }
    setShowPrompt(true);
  };

  return (
    <div>
      {showPrompt && !isAuthenticated && (
        <div className="mb-4 max-w-md">
          <LoginPromptInline action="menambah Section" onDismiss={() => setShowPrompt(false)} />
        </div>
      )}

      <PageHeader
        back={
          <Link
            to={backTo}
            params={{ songId: String(id) }}
            aria-label="Kembali ke lagu"
            className="inline-flex items-center text-sm text-stone-500 hover:text-stone-700"
          >
            <ArrowLeft className="size-4 sm:hidden" aria-hidden="true" />
            <span className="max-sm:hidden">← Kembali ke lagu</span>
          </Link>
        }
        title={`Launcher — ${song.name}`}
        subtitle="Tekan pad untuk loop Section — quantized trigger saat berpindah, tempo berubah hard cut jika BPM Section berbeda."
      />

      {playback.error ? (
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-800">{playback.error}</p>
        </div>
      ) : !ready ? (
        <p className="mt-6 text-sm text-stone-500" aria-busy="true">
          Menyiapkan audio (memuat & mendekode sample)…
        </p>
      ) : (song.sections ?? []).length === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-stone-200 p-10 text-center">
          <p className="text-sm font-medium text-stone-900">Lagu ini belum memiliki section</p>
          <p className="mt-1 text-sm text-stone-500">
            Section adalah bagian lagu (Awalan, Dasar, Naik, dst) yang menjadi pad di Launcher.
          </p>
          {isAuthenticated && !song.is_system_template && (
            <Link
              to="/songs/$songId"
              params={{ songId: String(id) }}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600"
            >
              + Tambah Section (Kelola Lagu)
            </Link>
          )}
        </div>
      ) : (
        <LauncherGrid
          sections={song.sections ?? []}
          songBpm={song.bpm}
          activeSectionId={playback.activeSectionId}
          pendingSectionId={playback.pendingSectionId}
          stepIndex={playback.stepIndex}
          isPlaying={playback.isPlaying}
          isPaused={playback.isPaused}
          mutedParts={playback.mutedParts}
          queue={playback.queue}
          cursor={playback.cursor}
          queueMode={playback.queueMode}
          tempBpm={playback.tempBpm}
          onTrigger={playback.trigger}
          onPlay={playback.play}
          onPause={playback.pause}
          onStop={playback.stop}
          onToggleMute={playback.toggleMute}
          onAddSection={handleAddSection}
          onEnqueue={playback.enqueue}
          onClearQueue={playback.clearQueue}
          onSetLoopCount={playback.setLoopCount}
          onRemoveRow={playback.removeRow}
          onMoveRow={playback.moveRow}
          onSetTempBpm={playback.setTempBpm}
        />
      )}

      <p className="mt-6 rounded-md border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600">
        <span className="font-semibold text-stone-800">Quantized Trigger:</span> saat Section lain
        sedang dimainkan, pad yang baru dipicu tidak langsung berhenti — ia menunggu titik akhir
        siklus (state “menunggu akhir siklus”) sebelum benar-benar berpindah. Begitu Section baru
        resmi mulai, angka BPM langsung berganti seketika ke tempo Section baru (hard cut), bukan
        transisi bertahap.
      </p>
    </div>
  );
}
