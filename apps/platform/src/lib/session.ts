/**
 * Penyimpanan access token di MEMORY (bukan localStorage) + helper session
 * (E-AUTH-2026 R4).
 *
 * Mengapa memory: access token pendek (15 menit) hilang saat refresh halaman,
 * tetapi itu disengaja — token TIDAK pernah bisa dibaca oleh skrip (XSS).
 * Pemulihan session setelah F5 dilakukan lewat `refreshSession()` yang memakai
 * refresh token di cookie httpOnly (tidak terlihat JavaScript).
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

let accessToken: string | null = null;
const tokenListeners = new Set<() => void>();
const sessionExpiredListeners = new Set<() => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const listener of tokenListeners) listener();
}

/** Subscribe perubahan access token — pasangan untuk `useSyncExternalStore`. */
export function subscribeAccessToken(listener: () => void): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

/** Cek sinkron — pengganti `hasToken()` lama yang membaca localStorage. */
export function hasToken(): boolean {
  return accessToken !== null;
}

/**
 * Mencoba memulihkan session via POST /auth/refresh (cookie httpOnly).
 * Sukses → access token baru tersimpan; gagal → null.
 *
 * `clearOnFailure: false` dipakai boot AuthContext: jangan hapus token yang
 * barangkali sudah terisi oleh login user di tengah-tengah refresh (race).
 */
export async function refreshSession(options?: { clearOnFailure?: boolean }): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      if (options?.clearOnFailure !== false) setAccessToken(null);
      return null;
    }
    const data = (await response.json()) as { token?: string };
    if (!data.token) {
      if (options?.clearOnFailure !== false) setAccessToken(null);
      return null;
    }
    setAccessToken(data.token);
    return data.token;
  } catch {
    if (options?.clearOnFailure !== false) setAccessToken(null);
    return null;
  }
}

/**
 * Logout server-side: cabut refresh token + hapus cookie, lalu bersihkan
 * access token di memory. Best-effort — access token selalu dibersihkan
 * walau request logout gagal (mis. jaringan mati).
 */
export async function logoutSession(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // Best-effort: token memory tetap dibersihkan. Bila jaringan mati, cookie
    // tidak terhapus — boot berikutnya akan memulihkan session via refresh,
    // dan user bisa logout lagi.
  } finally {
    setAccessToken(null);
  }
}

/** Notifikasi bahwa session tidak bisa dipulihkan (dipanggil customInstance). */
export function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) listener();
}

/** Subscribe notifikasi session expired — dipakai AuthContext untuk logout UI. */
export function subscribeSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}
