# Task 2: Refresh Token Backend (Bagian A — Backend)

> **Epic:** E-AUTH-2026 (docs/core/epic-auth-overhaul.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-24)

## Goal

Menambahkan lapisan refresh token di backend: access token JWT pendek (15
menit) dengan claims lengkap (`iss`, `aud`, `iat`, `exp`, `jti`), refresh
token acak 256-bit berumur 30 hari yang dirotasi tiap pemakaian + reuse
detection, dikirim via httpOnly cookie, plus `POST /auth/refresh` dan
`POST /auth/logout` (revoke server-side). **Frontend (Task 3) belum disentuh.**
Lihat catatan kompatibilitas di bawah.

## Implementasi — Slice

### Slice 1: `utility/token.go` (baru) — issue/parse access JWT + refresh generator

- `GenerateAccessToken(userID uint, email string) (string, error)` — JWT HS256,
  claims: `sub` (string), `user_id` (angka, agar middleware lama tetap jalan),
  `email`, `iss`, `aud`, `iat`, `exp` (15 menit), `jti` (uuid — sudah ada
  `github.com/google/uuid` di go.mod).
- `GenerateRefreshToken() (raw string, hash string, err)` — 32 byte acak
  (`crypto/rand`), raw = hex 64 char, hash = SHA-256 hex.
- Const: `AccessTokenTTL = 15 * time.Minute`, `RefreshTokenTTL = 30 * 24 * time.Hour`,
  `Audience = "bandjari-platform"`, `Issuer` dari env `JWT_ISSUER` (default
  `https://api.bandjari.net`).
- TDD: `utility/token_test.go` — round-trip issue/parse, exp terpenuhi,
  token expired ditolak, refresh raw ≠ hash & panjang benar. ✅

### Slice 2: `repository/refresh_token_repository.go` (baru) — CRUD refresh token

Interface + impl GORM (pola `user_repository.go`), tanpa unit test DB
(konsisten: repository existing tidak di-test langsung; logika diuji lewat
fake repo di service):

- `Create(*model.RefreshToken) error`
- `FindByTokenHash(hash string) (*model.RefreshToken, error)`
- `Rotate(old *model.RefreshToken, replacement *model.RefreshToken) error` —
  revoke yang lama (`RevokedAt`, `ReplacedByID`) + insert pengganti (transaksi)
- `RevokeAllByUserID(userID uint) error` — reuse detection / logout semua session
- `Revoke(token *model.RefreshToken) error` — logout satu token (ditambahkan
  saat implementasi: service.Revoke butuh revoke single-token, bukan rotasi)

### Slice 3: `service/token_service.go` (baru) — logika issue/rotate/reuse/revoke

Interface `TokenService` + impl dengan fake repo di test (pola
`user_service_test.go`). Error sentinel di `service/errors.go`:

- `IssueSession(userID uint, userAgent, ip string) (access, rawRefresh string, err)`
- `Refresh(raw string, userAgent, ip string) (access, newRaw string, err)` —
  hash → cari → cek revoked/expired → **reuse detection**: bila token sudah
  punya `ReplacedByID` (artinya sudah dirotasi) tapi masih dipakai lagi →
  anggap pencurian → `RevokeAllByUserID` + tolak. Bila valid → rotasi.
- `Revoke(raw string) error` — logout (idempotent bila token tak ditemukan)
- TDD (fake repo):
  - `IssueSession` menyimpan hash, bukan plaintext ✅
  - `Refresh` valid → token lama revoked + `ReplacedByID` terisi + token baru ✅
  - `Refresh` token yang sudah dirotasi (reuse) → semua session user direvoke ✅
  - `Refresh` token revoked/expired → error ✅
  - `Revoke` → token tak bisa dipakai lagi, idempotent ✅

### Slice 4: handler + routes + cookie

- `handler/user_handler.go`:
  - `LoginUser` — selain return `{token, role}` (kontrak lama dipertahankan),
    set cookie httpOnly `refresh_token` (Path=/api/v1/auth, Secure, SameSite=Lax,
    Max-Age=30 hari).
  - `RefreshSession` — baca cookie → `TokenService.Refresh` → return `{token}`
    + set cookie baru; 401 + hapus cookie bila gagal/reuse.
  - `Logout` — revoke cookie token, hapus cookie, selalu 204 (idempotent).
  - Helper private `setRefreshCookie` / `clearRefreshCookie`.
- `middleware/auth.go` — `parseToken`: validasi `iss` & `aud` **hanya bila
  klaim ada** (kompatibilitas token lama tanpa claims — anti lockout massal;
  token baru selalu punya claims dari Slice 1).
- `main.go` — `POST /auth/refresh`, `POST /auth/logout`.
- CORS `AllowCredentials: true` di `main.go` — wajib agar browser mengirim
  cookie refresh lintas-origin; produksi sudah eksplisit
  (`docker-compose.prod.yml` default `https://bandjari.net`) ✅.
- Verifikasi: `go build`, `go vet`, `go test ./...` — ✅ semua hijau.

## Catatan Kompatibilitas (penting)

- Access token berubah dari 24 jam → **15 menit**. Frontend lama (tanpa
  auto-refresh) akan logout paksa ±15 menit setelah login — **degradasi
  sementara yang disengaja** sampai Task 3 (frontend) selesai; perilaku sudah
  terdefinisi (AuthContext `isError → logout`, bukan crash).
- Token JWT lama (tanpa `iss`/`aud`/`jti`) tetap diterima middleware sampai
  exp — TIDAK ada logout massal (anti-pattern epic).
- `JWT_SECRET` TIDAK berubah — token lama tetap valid.

## Success Criteria

- [x] `go test ./...` lulus (termasuk test baru utility + token service)
- [x] `go vet ./...` & `go build ./...` bersih
- [x] Rotasi & reuse detection teruji (token lama setelah rotasi → revoke semua)
      — `TestTokenService_Refresh_ReuseDetected`
- [x] Cookie httpOnly terpasang di login/refresh; `SameSite=Lax`, `Path=/api/v1/auth`
- [x] Logout revoke refresh token server-side (bukan hanya hapus cookie)
- [x] Middleware masih menerima token lama (tanpa claims) sampai exp —
      `TestJWTAuth_AcceptsTokenWithoutIssAud`
- [x] Token dengan iss/aud salah ditolak — `TestJWTAuth_RejectsWrongIssuerOrAudience`
