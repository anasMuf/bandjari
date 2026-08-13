interface PlaybackIndicatorProps {
  activeSectionName: string | null;
  pendingSectionName: string | null;
  cycleLength: number;
  stepIndex: number;
}

/**
 * Indikator section aktif & posisi step dalam siklus (FR-PLAY-07/08).
 * Tidak bergantung warna semata — menyertakan teks status.
 */
export function PlaybackIndicator({
  activeSectionName,
  pendingSectionName,
  cycleLength,
  stepIndex,
}: PlaybackIndicatorProps) {
  if (!activeSectionName && !pendingSectionName) {
    return (
      <p className="text-sm text-gray-500" role="status">
        Tekan salah satu pad Section untuk mulai.
      </p>
    );
  }

  const shownStep = stepIndex % Math.max(cycleLength, 1);

  return (
    <div className="flex flex-wrap items-center gap-4" role="status" aria-live="polite">
      <p className="text-sm">
        {activeSectionName ? (
          <>
            <span className="font-semibold text-gray-900">Memutar: {activeSectionName}</span>
            {pendingSectionName && (
              <span className="ml-2 text-gray-500">→ berikutnya: {pendingSectionName}</span>
            )}
          </>
        ) : (
          <span className="text-gray-500">Berhenti</span>
        )}
      </p>

      {activeSectionName && cycleLength > 0 && (
        <div className="flex items-center gap-1" aria-label={`Langkah ${shownStep + 1} dari ${cycleLength}`}>
          {Array.from({ length: cycleLength }, (_, i) => (
            <span
              key={i}
              className={[
                'h-2 w-2 rounded-full transition-colors',
                i === shownStep ? 'bg-gray-900' : 'bg-gray-300',
              ].join(' ')}
            />
          ))}
          <span className="ml-1 text-xs text-gray-500">
            {shownStep + 1}/{cycleLength}
          </span>
        </div>
      )}
    </div>
  );
}
