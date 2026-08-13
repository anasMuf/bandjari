import type { LauncherSection } from '../hooks/useLauncherPlayback';
import { PlaybackIndicator } from './PlaybackIndicator';

interface LauncherGridProps {
  sections: LauncherSection[];
  activeSectionId: number | null;
  pendingSectionId: number | null;
  stepIndex: number;
  isPlaying: boolean;
  onTrigger: (section: LauncherSection) => void;
  onStop: () => void;
}

/**
 * Grid pad dinamis — satu pad per Section (FR-PLAY-01). Pad berukuran besar
 * agar mudah dioperasikan di layar sentuh (NFR-07).
 */
export function LauncherGrid({
  sections,
  activeSectionId,
  pendingSectionId,
  stepIndex,
  isPlaying,
  onTrigger,
  onStop,
}: LauncherGridProps) {
  const sorted = [...sections].sort((a, b) => a.order_index - b.order_index);
  const activeSection = sorted.find((s) => s.id === activeSectionId) ?? null;
  const pendingSection = sorted.find((s) => s.id === pendingSectionId) ?? null;
  const cycleLength = activeSection
    ? activeSection.parts.reduce((max, p) => Math.max(max, (p.steps ?? '').length), 0)
    : 0;

  return (
    <section aria-label="Launcher" className="mt-6">
      <PlaybackIndicator
        activeSectionName={activeSection?.name ?? null}
        pendingSectionName={pendingSection?.name ?? null}
        cycleLength={cycleLength}
        stepIndex={stepIndex}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : isPending
                    ? 'border-amber-400 bg-amber-50 text-gray-900'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400',
              ].join(' ')}
            >
              <span className="text-sm font-semibold">{section.name}</span>
              <span className={isActive ? 'text-xs text-gray-300' : 'text-xs text-gray-500'}>
                {section.bpm_override ?? '—'} BPM
              </span>
              {isActive && <span className="mt-1 text-xs font-medium">Memutar…</span>}
              {isPending && <span className="mt-1 text-xs font-medium text-amber-700">Menunggu siklus…</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={onStop}
          disabled={!isPlaying}
          className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          ■ Stop
        </button>
      </div>
    </section>
  );
}
