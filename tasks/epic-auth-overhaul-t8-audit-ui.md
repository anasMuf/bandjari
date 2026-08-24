# Task 8: Audit Events (8a) + UI Auth (8b)

> **Epic:** E-AUTH-2026 (docs/core/epic-auth-overhaul.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-24)

## Goal

- **8a — Audit events (gap 12)**: catat semua event auth ke tabel `audit_logs`
  (sudah ada sejak Task 1): `register`, `login_success`, `login_failed`,
  `login_locked`, `logout`, `refresh`, `verify_email`, `forgot_password`,
  `reset_password`, `google_login`, `role_change` (seeder admin).
- **8b — UI auth**: halaman `/verify` & `/reset-password` (link dari email),
  halaman `/forgot-password`, banner "verifikasi email", tombol "Masuk dengan
  Google". Serta **penyederhanaan backend**: verify/reset cukup pakai kode
  (tanpa email di URL).

---

# Bagian 8a — Audit Events (backend)

## Implementasi — Slice

### A1: `repository/audit_log_repository.go` + `service/audit_service.go`

- Repo: `Create(*model.AuditLog) error`. ✅
- `AuditService.Record(userID, action, detail, ip, userAgent)` + 11 konstanta. ✅
- Test (fake audit repo): action/ip/ua/detail json; userID nil diizinkan. ✅ (2 test)

### A2: `ErrAccountLocked` — bedakan lockout untuk audit (tetap 401 seragam)

- `service/errors.go`: + `ErrAccountLocked`. ✅
- `LoginUser`: lock aktif → `ErrAccountLocked`. ✅
- Update test: percobaan ke-6 → `ErrAccountLocked`. ✅

### A3: wiring audit di handler

- `handler/user_handler.go` (+ `auditService`): register, login_success,
  login_locked, login_failed, logout, refresh, verify_email, forgot_password,
  reset_password. ✅
- `handler/oauth_handler.go`: google_login. ✅
- `main.go`: wiring auditLogRepo + auditService. ✅

### A4: seeder admin → `role_change`

- `seeders/promote_admin/main.go`: insert `audit_logs` action `role_change`. ✅

## Success Criteria (8a)

- [x] `go test ./...` lulus (test audit service + login locked baru)
- [x] `go vet` & `go build` bersih
- [x] Semua 11 event tercatat di kode (register, login_success/failed/locked,
      logout, refresh, verify_email, forgot/reset_password, google_login,
      role_change)
- [x] Audit tidak menggagalkan operasi utama (best-effort)

---

# Bagian 8b — UI Auth (frontend)

## Implementasi — Slice

### B1: backend — verify/reset cukup kode (tanpa email di URL)

- `repository.UserRepository`: + `FindByVerificationTokenHash`,
  `FindByResetTokenHash` (+ fake repo). ✅
- `VerificationService.VerifyEmail(code)` & `PasswordResetService.ResetPassword(code,
  newPassword)` — cari user by hash; mengembalikan user (untuk audit). ✅
- Handler & DTO: `VerifyEmailRequest{Code}`, `ResetPasswordRequest{Code,
  Password}` (tanpa email). ✅
- Update test service. ✅
- Keputusan: kode verifikasi SEKALI PAKAI — verify kedua dengan kode basi
  ditolak (bukan idempotent); komentar interface diperbarui.

### B2: halaman frontend

- `/verify` — baca `?code=` → POST /auth/verify-email → status. ✅
- `/forgot-password` — form email → POST /auth/forgot-password. ✅
- `/reset-password` — baca `?code=`, form password (min 8 + konfirmasi). ✅
- Halaman login: link "Lupa password?" + tombol "Masuk dengan Google"
  (redirect ke `/auth/google`). ✅
- `VerifyEmailBanner` di shell `_app.tsx` (user unverified) + tombol kirim
  ulang. ✅
- Panggilan non-generated via `customInstance`. ✅
- `User` interface + `email_verified`. ✅

## Success Criteria (8b)

- [x] Halaman `/verify` menyelesaikan verifikasi (kode dari link email)
- [x] Halaman `/reset-password` & `/forgot-password` bekerja
- [x] Tombol Google redirect ke `/auth/google`
- [x] Banner verifikasi tampil untuk user unverified + tombol kirim ulang
- [x] `check` + `vitest` (99) + `build` lulus (frontend)
