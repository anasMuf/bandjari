import { useState } from 'react';
import { ListOrdered, Pause, Play, Plus, RotateCcw, Square, VolumeX } from 'lucide-react';
import type { LauncherSection } from '../hooks/useLauncherPlayback';
import type { QueueRow } from '../engine/section-player';
import { roundUpToStepMultiple, stepCount } from '../../../lib/steps';
import { scaleBpm } from '../../../lib/bpm';
import { PART_LABELS, PART_ORDER } from '../../sequencer/utils/parts';
import { LauncherQueue } from './LauncherQueue';
import { InfoPopover } from '../../../components/molecules/InfoPopover';

interface LauncherGridProps {
  sections: LauncherSection[];
  songBpm: number;
  activeSectionId: number | null;
  pendingSectionId: number | null;
  stepIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  mutedParts: Set<string>;
  queue: QueueRow[];
  cursor: number;
  queueMode: boolean;
  /** BPM dasar Song temporary (null = ikut BPM asli) — diskalakan proporsional ke semua section. */
  tempBpm: number | null;
  onTrigger: (section: LauncherSection) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onToggleMute: (partKey: string) => void;
  onAddSection: () => void;
  onEnqueue: (section: LauncherSection) => void;
  onClearQueue: () => void;
  onSetLoopCount: (index: number, loopCount: number) => void;
  onRemoveRow: (index: number) => void;
  onMoveRow: (from: number, to: number) => void;
  onSetTempBpm: (next: number | null) => void;
}

/**
 * Launcher Mode (layar 5 wireframe): grid pad dinamis — satu pad per Section —
 * dengan status per pad (sedang main / menunggu siklus / siap), step-dots pada
 * pad aktif, ★ untuk BPM override, tombol antrian di pojok kanan atas tiap pad,
 * dan bar transport (status + Antrian + Mute per Part + Stop). Interaksi tidak
 * mengandalkan warna semata — teks status selalu ada.
 */
export function LauncherGrid({
  sections,
  songBpm,
  activeSectionId,
  pendingSectionId,
  stepIndex,
  isPlaying,
  isPaused,
  mutedParts,
  queue,
  cursor,
  queueMode,
  tempBpm,
  onTrigger,
  onPlay,
  onPause,
  onStop,
  onToggleMute,
  onAddSection,
  onEnqueue,
  onClearQueue,
  onSetLoopCount,
  onRemoveRow,
  onMoveRow,
  onSetTempBpm,
}: LauncherGridProps) {
  const [queueOpen, setQueueOpen] = useState(false);
  const sorted = [...sections].sort((a, b) => a.order_index - b.order_index);
  const activeSection = sorted.find((s) => s.id === activeSectionId) ?? null;

  const bpmOf = (section: LauncherSection) => Math.round(scaleBpm(section.bpm_override, songBpm, tempBpm));
  const hasOverride = (section: LauncherSection) => section.bpm_override !== null;

  /** BPM dasar Song efektif (temporary bila diubah). */
  const baseBpm = tempBpm ?? songBpm;
  const clampBpm = (value: number) => Math.min(400, Math.max(20, value));
  const bpmStep = (delta: number) => onSetTempBpm(clampBpm(baseBpm + delta));

  /** Semua posisi (1-based) kemunculan section di antrian; [] = belum di-antre. */
  const queuedPositions = (sectionId: number): number[] =>
    queue.flatMap((row, index) => (row.sectionId === sectionId ? [index + 1] : []));

  const cycleLength = activeSection
    ? roundUpToStepMultiple(
        activeSection.parts.reduce((max, p) => Math.max(max, stepCount(p.steps ?? '')), 0),
      )
    : 0;

  const emptySampleCount = (section: LauncherSection) =>
    section.parts.filter((part) => part.sound_slots.every((slot) => slot.sample_id == null)).length;

  const onceLabel = (section: LauncherSection) => {
    if (section.loop !== false) return '';
    if (section.next_mode === 'end') return ' · 1× · Ending';
    if (section.next_mode === 'target') {
      const target = sorted.find((s) => s.id === section.next_section_id);
      return ` · 1× → ${target?.name ?? 'target'}`;
    }
    return ' · 1× → lanjut';
  };

  const padSub = (section: LauncherSection) => {
    const star = hasOverride(section) ? ' ★' : '';
    const once = onceLabel(section);
    const empty = emptySampleCount(section);
    if (section.id === activeSectionId) return `sedang main · ${bpmOf(section)} BPM${star}${once}`;
    if (section.id === pendingSectionId) return `menunggu akhir siklus... · ${bpmOf(section)} BPM${star}${once}`;
    return empty > 0
      ? `${empty}/${section.parts.length} sample kosong · ${bpmOf(section)} BPM${star}${once}`
      : `siap · ${bpmOf(section)} BPM${star}${once}`;
  };

  const shownStep = stepIndex % Math.max(cycleLength, 1);

  return (
    <section aria-label="Launcher" className="mt-6">
      {/* Transport bar — di atas grid pad; mobile: sticky tepat di bawah header (top-10 = tinggi header). */}
      <div
        data-transport-bar
        className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 ring-1 ring-stone-900/5 max-sm:sticky max-sm:top-10 max-sm:z-20 max-sm:-mx-4 max-sm:rounded-none max-sm:px-4"
      >
        <div className="flex min-w-0 items-center gap-3 max-sm:w-full max-sm:justify-between" aria-live="polite">
          <span
            className={[
              'shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold',
              queueMode ? 'bg-brand-50 text-brand-800' : 'bg-stone-100 text-stone-500',
            ].join(' ')}
          >
            {queueMode ? 'Mode Antrian' : 'Mode Biasa'}
          </span>

          {/* Hint kontrol — desktop: tampil terus (juga saat playing). */}
          <p className="text-sm text-stone-500 max-sm:hidden">
            Tekan ▶ Play (mulai per antrian) atau salah satu pad Section.
          </p>

          {/* Info playing ada di pad (pad aktif: "sedang main · BPM"; pad pending:
              "menunggu...") — status teks transport dihilangkan agar tidak redundan. */}
          <span className="sm:hidden">
            <InfoPopover content="Tekan ▶ Play (mulai per antrian) atau salah satu pad Section." />
          </span>
        </div>

        {/* Kontrol play dll — di mobile: baris tersendiri & terpusat; di desktop: rata kanan. */}
        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto">
          {/* Kontrol BPM Song temporary — realtime & tidak tersimpan (sesi saja).
              Baris tersendiri di tengah pada mobile view; sejajar kontrol play di desktop. */}
          <div className="flex w-full items-center justify-center gap-0.5 rounded-lg bg-white p-1 ring-1 ring-stone-300 sm:w-auto">
            <button
              type="button"
              onClick={() => bpmStep(-5)}
              disabled={baseBpm <= 20}
              aria-label="Kurangi 5 BPM"
              className="rounded px-1.5 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              −5
            </button>
            <button
              type="button"
              onClick={() => bpmStep(-1)}
              disabled={baseBpm <= 20}
              aria-label="Kurangi 1 BPM"
              className="rounded px-1.5 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              −1
            </button>
            <span
              data-bpm-value={baseBpm}
              className={[
                'min-w-12 px-1 text-center text-sm font-bold',
                tempBpm != null ? 'text-amber-700' : 'text-stone-800',
              ].join(' ')}
              title={tempBpm != null ? `Temporary — BPM asli Song: ${songBpm}` : 'BPM dasar Song'}
            >
              {baseBpm} BPM
            </span>
            <button
              type="button"
              onClick={() => bpmStep(1)}
              disabled={baseBpm >= 400}
              aria-label="Tambah 1 BPM"
              className="rounded px-1.5 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => bpmStep(5)}
              disabled={baseBpm >= 400}
              aria-label="Tambah 5 BPM"
              className="rounded px-1.5 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => onSetTempBpm(null)}
              disabled={tempBpm == null}
              aria-label="Reset BPM ke BPM asli Song"
              title="Reset BPM ke BPM asli Song"
              className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>

          {/* Kontrol play */}
          <button
            type="button"
            onClick={() => setQueueOpen((v) => !v)}
            aria-expanded={queueOpen}
            aria-label={`Antrian (${queue.length})`}
            className={[
              'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset transition-colors cursor-pointer max-sm:px-2.5',
              queueOpen
                ? 'bg-brand-700 text-white ring-brand-700'
                : 'bg-white text-stone-900 ring-stone-300 hover:bg-stone-50',
            ].join(' ')}
          >
            <ListOrdered className="size-4" />
            <span className="max-sm:hidden">Antrian ({queue.length})</span>
          </button>

          <button
            type="button"
            onClick={onPlay}
            disabled={isPlaying && !isPaused}
            aria-label="Play"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer max-sm:px-2.5"
          >
            <Play className="size-4" />
            <span className="max-sm:hidden">Play</span>
          </button>

          <button
            type="button"
            onClick={onPause}
            disabled={!isPlaying || isPaused}
            aria-label="Pause"
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer max-sm:px-2.5"
          >
            <Pause className="size-4" />
            <span className="max-sm:hidden">Pause</span>
          </button>

          <button
            type="button"
            onClick={onStop}
            disabled={!isPlaying}
            aria-label="Stop"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer max-sm:px-2.5"
          >
            <Square className="size-4" />
            <span className="max-sm:hidden">Stop</span>
          </button>

          <details className="relative">
            <summary className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 ring-1 ring-stone-300 ring-inset transition-colors hover:bg-stone-50 select-none max-sm:px-2.5">
              <VolumeX className="size-4" />
              <span className="max-sm:hidden">Mute Part…</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-stone-200 bg-white p-3 shadow-lg">
              <fieldset>
                <legend className="text-xs font-semibold text-stone-500">
                  Bunyikan/redam per Part (FR-PLAY-10)
                </legend>
                <ul className="mt-2 space-y-1.5">
                  {PART_ORDER.map((partKey) => (
                    <li key={partKey}>
                      <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mutedParts.has(partKey)}
                          onChange={() => onToggleMute(partKey)}
                          className="size-4 rounded border-stone-300 accent-brand-700"
                        />
                        {PART_LABELS[partKey] ?? partKey}
                        {mutedParts.has(partKey) && <span className="text-xs text-stone-400">(senyap)</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </div>
          </details>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sorted.map((section) => {
          const isActive = section.id === activeSectionId;
          const isPending = section.id === pendingSectionId;
          const positions = queuedPositions(section.id);
          return (
            <div key={section.id} className="relative">
              <button
                type="button"
                aria-pressed={isActive}
                aria-label={`Mainkan section ${section.name}`}
                onClick={() => onTrigger(section)}
                className={[
                  'flex min-h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 px-3 py-4 transition-colors cursor-pointer',
                  isActive
                    ? 'border-brand-800 bg-brand-800 text-white'
                    : isPending
                      ? 'animate-pending border-dashed border-amber-500 bg-amber-50 text-stone-900'
                      : 'border-stone-200 bg-white text-stone-900 hover:border-brand-700',
                ].join(' ')}
              >
                <span className="text-sm font-semibold">{section.name}</span>
                <span className={isActive ? 'text-xs text-brand-100' : 'text-xs text-stone-500'}>
                  {padSub(section)}
                </span>

                {isActive && cycleLength > 0 && (
                  <span
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={cycleLength}
                    aria-valuenow={shownStep + 1}
                    className="mt-1 block h-1 w-24 overflow-hidden rounded-full bg-white/30"
                  >
                    <span className="sr-only">
                      Langkah {shownStep + 1} dari {cycleLength}
                    </span>
                    <span
                      className="block h-full rounded-full bg-white"
                      style={{
                        width: `${((shownStep + 1) / Math.max(cycleLength, 1)) * 100}%`,
                      }}
                    />
                  </span>
                )}
              </button>

              {/* Pojok kanan atas: badge nomor antrian (pill, kiri) + tombol tambah antrian (kanan).
                  Badge menampilkan SEMUA posisi dipisah "|" dan memanjang berbentuk pil. */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                {positions.length > 0 && (
                  <span
                    data-queue-positions={positions.join('|')}
                    title={`${section.name} di antrian posisi ${positions.join('|')}`}
                    className="flex h-6 items-center rounded-full bg-brand-700 px-2 text-xs font-bold text-white shadow-sm"
                  >
                    {positions.join('|')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onEnqueue(section)}
                  aria-label={
                    positions.length > 0
                      ? `Tambahkan ${section.name} ke antrian — sudah di antrian posisi ${positions.join('|')}`
                      : `Tambahkan ${section.name} ke antrian`
                  }
                  title="Tambahkan ke antrian"
                  className="flex size-6 items-center justify-center rounded-full bg-white/90 text-stone-500 ring-1 ring-stone-300 transition-colors hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Pad placeholder = Section baru (jumlah pad dinamis) */}
        <button
          type="button"
          onClick={onAddSection}
          className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-stone-300 px-3 py-4 text-stone-400 transition-colors hover:border-brand-700 hover:text-brand-700 cursor-pointer"
        >
          <span className="text-sm">+ pad baru = Section baru</span>
          <span className="text-xs">jumlah pad dinamis</span>
        </button>
      </div>

      <p className="mt-2 text-xs text-stone-400">
        ★ = Section dengan BPM override, berbeda dari BPM dasar Song ({baseBpm}
        {tempBpm != null ? ' — temporary' : ''})
      </p>

      <LauncherQueue
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        queue={queue}
        cursor={cursor}
        sections={sections}
        activeSectionId={activeSectionId}
        onSetLoopCount={onSetLoopCount}
        onRemoveRow={onRemoveRow}
        onMoveRow={onMoveRow}
        onClearQueue={onClearQueue}
      />
    </section>
  );
}
