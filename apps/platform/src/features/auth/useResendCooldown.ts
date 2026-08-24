import { useCallback, useEffect, useState } from 'react';

/**
 * Countdown cooldown kirim ulang email (default 60 detik) — sinkron dengan
 * cooldown server-side (E-AUTH-2026 R9, VerificationCooldown).
 *
 * `activeOnMount: true` → cooldown langsung aktif (mis. email verifikasi sudah
 * terkirim otomatis saat daftar). `false` → aktif setelah `start()` dipanggil
 * (mis. tombol kirim ulang di banner).
 */
export function useResendCooldown(activeOnMount: boolean, seconds = 60) {
  const [remaining, setRemaining] = useState(activeOnMount ? seconds : 0);

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(interval);
  }, [remaining]);

  const start = useCallback(() => setRemaining(seconds), [seconds]);

  return { remaining, active: remaining > 0, start };
}
