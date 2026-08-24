# Task 3: Frontend — Token di Memory + Auto-Refresh (Bagian A — Frontend)

> **Epic:** E-AUTH-2026 (docs/core/epic-auth-overhaul.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-24)

## Goal

Menutup gap #1 end-to-end: access token TIDAK lagi di `localStorage` — disimpan
di memory. `customInstance` otomatis refresh via cookie (httpOnly) saat 401 dan
retry sekali. Logout memanggil server (`POST /auth/logout`). Session pulih
setelah F5 via boot refresh. Tidak ada route guard aktif yang perlu diubah
(UI men-drive auth via `isAuthenticated` — FR-AUTH-07).

## Implementasi — Slice

### Slice 1: `src/lib/session.ts` (baru) — token store memory + session helpers

- `accessToken: string | null` module-level + `getAccessToken` / `setAccessToken`
  (notify listeners) / `subscribeAccessToken` (untuk `useSyncExternalStore`).
- `hasToken(): boolean` — cek sinkron (pengganti `hasToken()` lama berbasis
  localStorage).
- `refreshSession(): Promise<string | null>` — POST `/auth/refresh` via fetch
  (`credentials: 'include'`), sukses → setAccessToken; gagal → null + clear.
- `logoutSession(): Promise<void>` — POST `/auth/logout` (best-effort) + clear.
- `subscribeSessionExpired` / `notifySessionExpired` — sinyal dari customInstance
  saat 401 tidak bisa dipulihkan (agar AuthContext logout).
- `refreshSession({ clearOnFailure })` — opsi `clearOnFailure:false` untuk boot
  AuthContext (race: login user di tengah-tengah refresh tidak diinjak).
- TDD: `src/lib/session.test.ts` — mock fetch: refresh sukses/gagal, logout,
  subscribe, clear di boot. ✅ (7 test)

### Slice 2: `src/api/mutator/custom-instance.ts` — token dari store + auto-refresh

- Ganti `localStorage.getItem('token')` → `getAccessToken()` dari session store.
- `credentials: 'include'` di semua request (cookie refresh lintas-origin).
- 401 → bila bukan path `/auth/*` DAN access token ada → `refreshSession()`
  single-flight → retry sekali. Gagal → `notifySessionExpired()` + throw ApiError.
- Path `/auth/*` tidak memicu auto-refresh (login gagal ≠ session expired).
- TDD: `src/api/mutator/custom-instance.test.ts` — mock fetch global:
  sukses, 401→refresh→retry, refresh gagal → notify + throw, `/auth/login` 401
  tidak me-refresh. ✅ (5 test)

### Slice 3: `src/features/auth/AuthContext.tsx` — memory token + boot + logout server

- Token: `useSyncExternalStore(subscribeAccessToken, getAccessToken)`.
- Boot (mount): bila token null → `refreshSession()`; selesai → `booting=false`.
  Sekali jalan: hapus peninggalan `localStorage['token'|'role']` (migrasi).
- `useGetUsers({ enabled: !!accessToken && !booting })`.
- `isError` / `subscribeSessionExpired` → session invalid → clear + removeQueries.
- `login(token, role)` → `setAccessToken` + roleOverride (memory saja).
- `logout()` → `logoutSession()` (revoke server-side) + clear + removeQueries.
- `hasToken()` re-export dari session store (API sama, tanpa localStorage).
- TDD: `src/features/auth/AuthContext.test.tsx` (jsdom, mock fetch global):
  boot dengan cookie valid → authenticated; tanpa cookie → guest;
  login → authenticated; logout → panggil `/auth/logout`;
  tidak ada token di localStorage. ✅ (5 test)

### Slice 4: verifikasi

- `pnpm --filter platform check` (biome)
- `pnpm --filter platform exec vitest run`
- `pnpm --filter platform build` (type-check + bundle)
- `grep -r "localStorage" src` → hanya sisa migrasi di AuthContext boot

## Catatan

- `RegisterForm` & `ProfileView` tidak perlu diubah (login/logout API sama).
- `LoginPromptInline`/route guard: tidak ada guard berbasis `hasToken()` aktif —
  konfirmasi via grep sebelum mengubah apa pun.
- Setelah deploy, user yang login sebelum fitur cookie: token localStorage
  stale + tanpa cookie → guest sekali → login ulang (perilaku benar).

## Success Criteria

- [x] Tidak ada akses `localStorage` untuk token (grep: sisa hanya migrasi/komentar)
- [x] 401 → auto-refresh → retry sekali (diuji `custom-instance.test.ts`)
- [x] Refresh gagal → notify session expired → UI logout (diuji)
- [x] F5/boot dengan cookie valid → session pulih otomatis (diuji `AuthContext.test.tsx`)
- [x] Logout memanggil `POST /auth/logout` server-side (diuji)
- [x] `check` + `vitest` (99 test) + `build` lulus
