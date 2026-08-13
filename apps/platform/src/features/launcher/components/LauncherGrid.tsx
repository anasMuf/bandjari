import type { LauncherSection } from '../hooks/useLauncherPlayback';
import { stepCount } from '../../../lib/steps';
import { PART_LABELS, PART_ORDER } from '../../sequencer/utils/parts';

interface LauncherGridProps {
  sections: LauncherSection[];
  songBpm: number;
  activeSectionId: number | null;
  pendingSectionId: number | null;
  stepIndex: number;
  isPlaying: boolean;
  mutedParts: Set<string>;
  onTrigger: (section: LauncherSection) => void;
  onStop: () => void;
  onToggleMute: (partKey: string) => void;
  onAddSection: () => void;
}

/**
 * Launcher Mode (layar 5 wireframe): grid pad dinamis — satu pad per Section —
 * dengan status per pad (sedang main / menunggu siklus / siap), step-dots pada
 * pad aktif, ★ untuk BPM override, dan bar transport (status + Mute per Part +
 * Stop). Interaksi tidak mengandalkan warna semata — teks status selalu ada.
 */
export function LauncherGrid({
  sections,
  songBpm,
  activeSectionId,
  pendingSectionId,
  stepIndex,
  isPlaying,
  mutedParts,
  onTrigger,
  onStop,
  onToggleMute,
  onAddSection,
}: LauncherGridProps) {
  const sorted = [...sections].sort((a, b) => a.order_index - b.order_index);
  const activeSection = sorted.find((s) => s.id === activeSectionId) ?? null;
  const pendingSection = sorted.find((s) => s.id === pendingSectionId) ?? null;

  const bpmOf = (section: LauncherSection) => section.bpm_override ?? songBpm;
  const hasOverride = (section: LauncherSection) => section.bpm_override !== null;

  const cycleLength = activeSection
    ? activeSection.parts.reduce((max, p) => Math.max(max, stepCount(p.steps ?? '')), 0)
    : 0;

  const emptySampleCount = (section: LauncherSection) =>
    section.parts.filter((part) => part.sound_slots.every((slot) => slot.sample_id == null)).length;

  const padSub = (section: LauncherSection) => {
    const star = hasOverride(section) ? ' ★' : '';
    const empty = emptySampleCount(section);
    if (section.id === activeSectionId) return `sedang main · ${bpmOf(section)} BPM${star}`;
    if (section.id === pendingSectionId) return `menunggu akhir siklus... · ${bpmOf(section)} BPM${star}`;
    return empty > 0
      ? `${empty}/${section.parts.length} sample kosong · ${bpmOf(section)} BPM${star}`
      : `siap · ${bpmOf(section)} BPM${star}`;
  };

  const shownStep = stepIndex % Math.max(cycleLength, 1);

  return (
    <section aria-label="Launcher" className="mt-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sorted.map((section) => {
          const isActive = section.id === activeSectionId;
          const isPending = section.id === pendingSectionId;
          return (
            <button
              key={section.id}
              type="button"
              aria-pressed={isActive}
              aria-label={`Mainkan section ${section.name}`}
              onClick={() => onTrigger(section)}
              className={[
                'flex min-h-28 flex-col items-center justify-center gap-1 rounded-lg border-2 px-3 py-4 transition-colors cursor-pointer',
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
                <span className="mt-1 flex items-center gap-1">
                  <span className="sr-only">
                    Langkah {shownStep + 1} dari {cycleLength}
                  </span>
                  {Array.from({ length: cycleLength }, (_, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: titik step bersifat posisional dalam siklus
                      key={i}
                      className={[
                        'size-1.5 rounded-full',
                        i === shownStep ? 'bg-white' : 'bg-white/40',
                      ].join(' ')}
                    />
                  ))}
                </span>
              )}
            </button>
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
        ★ = Section dengan BPM override, berbeda dari BPM dasar Song ({songBpm})
      </p>

      {/* Transport bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 ring-1 ring-stone-900/5">
        <div className="flex min-w-0 items-center gap-3" aria-live="polite">
          {isPlaying ? (
            <p className="text-sm text-stone-700">
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-800">
                Sedang Main
              </span>{' '}
              <span className="font-semibold text-stone-900">{activeSection?.name ?? '—'}</span> —{' '}
              <span className="font-semibold text-stone-900">{bpmOf(activeSection ?? sorted[0])} BPM</span>
              {pendingSection && (
                <>
                  {' '}
                  — akan pindah ke{' '}
                  <span className="font-semibold text-stone-900">{pendingSection.name}</span> (
                  {bpmOf(pendingSection)} BPM) di akhir siklus
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-stone-500">Tekan salah satu pad Section untuk mulai.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <details className="relative">
            <summary className="inline-flex cursor-pointer items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 ring-1 ring-stone-300 ring-inset transition-colors hover:bg-stone-50 select-none">
              Mute Part…
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

          <button
            type="button"
            onClick={onStop}
            disabled={!isPlaying}
            className="inline-flex items-center justify-center rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            ■ Stop
          </button>
        </div>
      </div>
    </section>
  );
}
