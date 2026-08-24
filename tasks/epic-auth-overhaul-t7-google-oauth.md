# Task 7: Google OAuth (Bagian E)

> **Epic:** E-AUTH-2026 (docs/core/epic-auth-overhaul.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-24) — backend; tombol UI → Task 8

## Goal

Menutup gap 10: login dengan Google (satu provider, keputusan Q2).

- `GET /api/v1/auth/google` — redirect ke Google (state di cookie httpOnly
  sementara; exchange token dilakukan **server-side** memakai client secret —
  access token TIDAK pernah lewat URL/frontend).
- `GET /api/v1/auth/google/callback` — verifikasi state → tukar code →
  userinfo → **upsert user by email** → `IssueSession` → set refresh cookie →
  redirect ke frontend. SPA pulih otomatis lewat boot refresh (mekanisme Task 3
  sudah ada — tanpa access token di URL).
- Akun dari Google: `email_verified_at` langsung terisi bila Google
  mengonfirmasi (`verified_email`); password kosong (tidak bisa login password).
- Kredensial via env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REDIRECT_URL` (default dev `http://localhost:8080/...`; produksi
  `https://api.bandjari.net/api/v1/auth/google/callback`).

## Implementasi — Slice

### Slice 1: `config/google.go` (baru) + dep

- `go get golang.org/x/oauth2` (v0.36). ✅
- `GoogleConfig{ClientID, ClientSecret, RedirectURL}` + `LoadGoogleConfig()`. ✅

### Slice 2: `service/oauth_service.go` (baru, TDD)

- `GoogleUserInfo{Email, Name, EmailVerified}`.
- `OAuthService.LoginOrCreateUser(info)`:
  - Email terdaftar → return user; bila `EmailVerifiedAt` kosong → isi (email
    Google terverifikasi = cukup bukti).
  - Email belum terdaftar → buat user baru (Name, Email, `PasswordHash: ""` —
    tidak bisa login password, Role user, verified sesuai info).
- TDD (fake repo): link akun existing + set verified; buat akun baru; user baru
  tersimpan; akun existing tetap dipertahankan (role tidak diubah). ✅ (4 test)

### Slice 3: `handler/oauth_handler.go` (baru) + wiring

- `GoogleLogin` — state acak (32 byte) → cookie `oauth_state` (httpOnly,
  Secure, SameSite=Lax, Path=/api/v1/auth/google, Max-Age 5 menit) → redirect
  Google authorize (scope `openid email profile`).
- `GoogleCallback` — verifikasi state (cookie == query) → exchange code →
  `GET /oauth2/v2/userinfo` → `LoginOrCreateUser` → `IssueSession` → set
  refresh cookie (reuse helper `setRefreshCookie`) → redirect
  `{APP_BASE_URL}` (SPA boot-refresh memulihkan session). Bila gagal → redirect
  ke `{APP_BASE_URL}/login?error=google`.
- `main.go`: wiring `OAuthService` + `OAuthHandler`; bila config kosong → route
  tetap terdaftar tapi 503 "Google OAuth belum dikonfigurasi". ✅
- `handler/user_handler.go`: `setRefreshCookie` dipakai dua handler — tetap
  private di package handler. ✅
- `docker-compose.prod.yml`: env pass-through `SMTP_*`, `APP_BASE_URL`,
  `JWT_ISSUER`, `GOOGLE_*` (default kosong → nonaktif). ✅
- `utility.AppBaseURL()` — dipindah dari service (dipakai handler OAuth juga). ✅

## Catatan

- Frontend tombol "Masuk dengan Google" (link ke `/auth/google`) → Task 8.
- `GOOGLE_CLIENT_ID/SECRET` diisi user di `.env` (dev) & env VPS (produksi).
- PKCE tidak dipakai: exchange server-side dengan client secret (bukan public
  client murni) — cukup aman & sederhana untuk satu provider.
- Redirect URL harus PERSIS sama dengan yang didaftarkan di Google Cloud
  Console (prod + localhost sudah didaftarkan user ✅).

## Success Criteria

- [x] `go test ./...` lulus (termasuk test oauth service — 4 test baru)
- [x] `go vet` & `go build` bersih
- [x] Upsert: akun existing di-link (verified diisi), akun baru dibuat — diuji
- [x] State di-cookie + diverifikasi di callback
- [x] Access token tidak pernah muncul di URL (server-side exchange)
- [x] Config kosong → fitur nonaktif (503), bukan crash
