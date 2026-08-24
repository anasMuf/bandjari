# Task 6: Password Reset (Bagian C)

> **Epic:** E-AUTH-2026 (docs/core/epic-auth-overhaul.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-24) — backend; UI → Task 8

## Goal

Menutup gap 6: alur lupa password.

- `POST /auth/forgot-password` — token reset TTL **1 jam** (hash SHA-256 di DB),
  dikirim via mailer (reuse `service/mailer.go`). Respons **selalu 200 seragam**
  (anti email-enumeration).
- `POST /auth/reset-password` — password baru wajib policy 8–72 (NIST); sukses
  → **revoke SEMUA refresh token** user (semua sesi mati, harus login ulang),
  reset lockout counter, set `PasswordChangedAt`.

## Implementasi — Slice

### Slice 1: model

- `model/user.go`: + `ResetTokenHash` (char(64), nullable),
  `ResetExpiresAt` (*time.Time, nullable) — `json:"-"`. ✅

### Slice 2: `service/password_reset_service.go` (baru, TDD)

- Const `ResetTokenTTL = time.Hour`.
- `PasswordResetService`:
  - `RequestPasswordReset(email)` — cari user; tak ada → `nil` (anti-enum, tanpa
    email); buat kode → simpan hash+expiry → kirim email
    (`{APP_BASE_URL}/reset-password?code=...`).
  - `ResetPassword(email, code, newPassword)` — semua kegagalan (email tak
    dikenal, kode salah/kedaluwarsa) → `ErrInvalidResetToken` seragam; password
    < 8 atau > 72 → `ErrWeakPassword`; sukses → bcrypt hash baru,
    `PasswordChangedAt=now`, bersihkan token, `FailedLoginAttempts=0`,
    `LockedUntil=nil`, lalu `RevokeAllByUserID`.
- `service/errors.go`: + `ErrInvalidResetToken`.
- TDD (reuse `fakeMailer`, `fakeRefreshRepo`, `fakeTokenUserRepo`):
  - request → hash tersimpan + email terkirim; email tak dikenal → no-op ✅
  - reset kode valid → password berubah (hash bcrypt baru), semua refresh token
    user direvoke, token dibersihkan, lockout reset ✅
  - reset kode salah / expired / email tak dikenal → `ErrInvalidResetToken` ✅
  - reset password lemah → `ErrWeakPassword`, token TIDAK dibersihkan & sesi
    TIDAK dicabut ✅

### Slice 3: handler + routes + DTO

- `dto/user.go`: `ForgotPasswordRequest{Email}`,
  `ResetPasswordRequest{Email, Code, Password}`. ✅
- `handler/user_handler.go`: `ForgotPassword` (selalu 200), `ResetPassword`
  (400 seragam / 200 sukses). ✅
- `main.go`: wiring `passwordResetService` (userRepo + refreshTokenRepo +
  mailer) + 2 route; handler constructor. ✅

## Catatan

- Setelah reset: semua sesi mati (revoke refresh) → user login ulang dengan
  password baru. Access token 15 menit mati sendiri.
- User yang terkunci (lockout) bisa reset password → counter & lock dibersihkan.
- Env: `APP_BASE_URL` (sudah ada dari Task 5) untuk link reset.
- UI (halaman `/reset-password`) → Task 8.

## Success Criteria

- [x] `go test ./...` lulus (termasuk test password reset — 7 test baru)
- [x] `go vet` & `go build` bersih
- [x] Forgot-password: respons seragam (anti-enumeration) — diuji
- [x] Reset kode valid → password berubah + semua sesi direvoke — diuji
- [x] Kode salah/expired → error seragam — diuji
- [x] Password lemah → ditolak tanpa efek samping — diuji
