# Task 4: Rate Limit + Account Lockout (Bagian B)

> **Epic:** E-AUTH-2026 (docs/core/epic-auth-overhaul.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-24)

## Goal

Menutup gap 3 (rate limit) & 4 (account lockout) pada endpoint auth:

- **Rate limit per IP** di semua route `/api/v1/auth/*` (limiter bawaan Echo,
  memory store — cukup untuk single-instance VPS).
- **Account lockout**: 5 kegagalan berturut-turut → akun terkunci 15 menit
  (progressive: 15m → 30m → 1h), counter reset saat login sukses. Kolom
  `failed_login_attempts` + `locked_until` sudah ada (Task 1).
- **Anti-enumeration dipertahankan**: semua kegagalan (termasuk saat akun
  terkunci) tetap mengembalikan "Email atau password salah" (401 seragam) —
  attacker tidak bisa membedakan email terdaftar via pesan lockout. Rate limit
  per IP yang menangani volume.

## Implementasi — Slice

### Slice 1: `repository/user_repository.go` — tambah `Save`

- Interface + impl GORM: `Save(user *model.User) error` (`db.Save`). ✅
- Update semua fake repo yang mengimplementasikan interface (build/kompilasi
  memaksa): `service/user_service_test.go`, `middleware/auth_test.go`,
  `service/token_service_test.go`. ✅

### Slice 2: lockout di `service/user_service.go` (TDD)

- Const: `MaxLoginAttempts = 5`; durasi lock: 15m (attempts 5–9), 30m (10–14),
  1h (15+).
- `LoginUser(email, password)`:
  1. `FindByEmail` → tidak ada → `ErrInvalidCredentials` (tanpa counter — email
     tidak dikenal tidak boleh di-lock, anti-enumeration).
  2. Bila `LockedUntil` masih masa depan → `ErrInvalidCredentials` (seragam),
     counter TIDAK bertambah lagi.
  3. `CompareHashAndPassword` gagal → increment `FailedLoginAttempts`; bila
     mencapai/melewati `MaxLoginAttempts` → set `LockedUntil` = now + durasi
     progressive → `Save` → `ErrInvalidCredentials`.
  4. Sukses → reset `FailedLoginAttempts = 0` + `LockedUntil = nil` → `Save`.
- TDD (`user_service_test.go`):
  - `TestLoginUser_LocksAfterFiveFailures` — 5 gagal → ke-6 (password benar) ditolak ✅
  - `TestLoginUser_LockExpires_LoginSucceedsAndResets` — lock lewat → sukses + reset ✅
  - `TestLockDurationProgressive` — 15m/30m/1h per tahap ✅
  - `TestLoginUser_UnknownEmailDoesNotLock` — anti-enumeration ✅

### Slice 3: rate limiter di `main.go`

- `echoMiddleware.RateLimiterWithConfig` global, `Skipper`: hanya route
  `/api/v1/auth/*`. ✅
- Config: `Rate: rate.Limit(10.0/60.0)` (≈10/menit), `Burst: 10`,
  `ExpiresIn: 3 * time.Minute`, `ErrorHandler` → 429 JSON. ✅
- `handler/error_handler.go`: kode `TOO_MANY_REQUESTS` ditambahkan agar 429
  memakai format error contract yang sama. ✅
- Memory store (per-instance) — cukup untuk 1 VPS; multi-replica butuh store
  eksternal (Redis) — di luar scope.

## Catatan

- Timing attack pada email tidak dikenal tanpa dummy bcrypt compare: perilaku
  existing dipertahankan (tidak diubah di task ini — catat sebagai observasi).
- Audit event `login_failed`/`login_locked` menyusul di Task 8 (audit lengkap);
  kolom `audit_logs` sudah siap.

## Success Criteria

- [x] `go test ./...` lulus (termasuk test lockout baru)
- [x] `go vet` & `go build` bersih
- [x] 5 kegagalan → akun terkunci (password benar pun ditolak) — diuji
- [x] Lock kedaluwarsa / login sukses → counter reset — diuji
- [x] Durasi lock progressive (15m → 30m → 1h) — diuji
- [x] Pesan error tetap seragam (anti-enumeration) — diuji
      (`TestLoginUser_UnknownEmailDoesNotLock`)
- [x] Rate limit 429 terpasang hanya pada `/api/v1/auth/*` (Skipper benar)
