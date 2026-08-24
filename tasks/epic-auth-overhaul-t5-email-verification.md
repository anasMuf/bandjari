# Task 5: Email Verification (Bagian C)

> **Epic:** E-AUTH-2026 (docs/core/epic-auth-overhaul.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-24) — backend; UI banner → Task 8

## Goal

Menutup gap 5: verifikasi email. Register → kirim link verifikasi (TTL 24 jam,
sekali pakai, hash SHA-256 di DB). Endpoint `POST /auth/verify-email` dan
`POST /auth/resend-verification` (rate limited otomatis via `/auth/*`).
Akun unverified **tetap bisa login** (keputusan Q3). Email dikirim via SMTP
(`github.com/wneessen/go-mail`); saat env SMTP kosong → dicetak ke log (dev).

## Implementasi — Slice

### Slice 1: model + utility

- `model/user.go`: + `VerificationTokenHash` (char(64), nullable),
  `VerificationExpiresAt` (*time.Time, nullable) — `json:"-"` (rahasia). ✅
  `EmailVerifiedAt` sudah ada dari Task 1.
- `utility/token.go`: `GenerateVerificationCode() (raw, hash string, err)`. ✅
- AutoMigrate otomatis (User sudah terdaftar).

### Slice 2: `service/mailer.go` (baru)

- `Mailer` interface: `Send(toEmail, subject, body string) error`. ✅
- `consoleMailer` — cetak ke log (dev, env SMTP kosong). ✅
- `smtpMailer` — `github.com/wneessen/go-mail` v0.8.1 (STARTTLS 587,
  TLSMandatory). ✅
- `NewMailer()` baca env: `SMTP_HOST/PORT/USERNAME/PASSWORD/FROM_EMAIL`. ✅

### Slice 3: `service/verification_service.go` (baru, TDD)

- Const `VerificationTTL = 24 * time.Hour`.
- `VerificationService`:
  - `RequestEmailVerification(email)` — cari user; tak ada → `nil` (anti-enum,
    tanpa email terkirim); sudah verified → `nil` (no-op); else buat kode →
    simpan hash+expiry → `mailer.Send` (link
    `{APP_BASE_URL}/verify?code=...`).
  - `VerifyEmail(email, code)` — semua kegagalan (email tak dikenal, kode
    salah, kedaluwarsa) → `ErrInvalidVerificationCode` (seragam); sukses →
    `EmailVerifiedAt` + bersihkan hash/expiry; sudah verified → `nil`
    (idempotent).
- `service/errors.go`: + `ErrInvalidVerificationCode`.
- TDD (fake user repo + fake mailer):
  - request → hash tersimpan, email terkirim dengan kode ✅
  - request untuk email tak dikenal → tidak error & tidak kirim email ✅
  - request saat sudah verified → tidak kirim ulang ✅
  - verify kode benar → verified + token dibersihkan ✅
  - verify kode salah / expired / email tak dikenal → error seragam ✅
  - verify dua kali → idempotent ✅

### Slice 4: handler + routes + DTO

- `dto/user.go`: `VerifyEmailRequest{Email, Code}`,
  `ResendVerificationRequest{Email}`; `UserResponse` + `EmailVerified bool`. ✅
- `handler/user_handler.go`:
  - `CreateUser` — kirim verifikasi best-effort + pesan baru ✅
  - `VerifyEmail` (POST /auth/verify-email) ✅
  - `ResendVerification` (POST /auth/resend-verification) — 200 seragam ✅
- `service/user_service.go` `toUserResponse`: `EmailVerified`. ✅
- `main.go`: wiring `verificationService` + 2 route + handler constructor. ✅
- Frontend route `/verify` + banner → Task 8 (backend dulu; link sementara 404).

## Catatan

- Env baru: `SMTP_*`, `APP_BASE_URL` (default `http://localhost:3000`; produksi
  wajib `https://bandjari.net`).
- Anti-enumeration dipertahankan: resend & verify respons seragam.
- Login unverified TIDAK diblokir (Q3) — tidak ada perubahan LoginUser.

## Success Criteria

- [x] `go test ./...` lulus (termasuk test verification — 7 test baru)
- [x] `go vet` & `go build` bersih
- [x] Register → token tersimpan (hash) + email terkirim (dev: log)
- [x] Verify kode valid → `email_verified_at` terisi; kode salah/expired →
      error seragam — diuji
- [x] Resend: anti-enumeration (respons sama untuk email ada/tidak ada) — diuji
- [x] UserResponse memuat `email_verified` (backend)
