# Epic: Auth Overhaul — Standar Industri (E-AUTH-2026)

> **Status:** Disetujui (design validated) · **Tipe:** Epic · **Prioritas:** 1
> **Dibuat:** 2026-08-24 · **Referensi:** FR-AUTH-01–07, gap 1–10, 12

Epic ini memodernisasi autentikasi BandJari agar mengikuti standar industri
(OWASP ASVS, NIST SP 800-63B, OAuth 2.1). Gap yang **dipilih** untuk dikerjakan:
1 (localStorage), 2 (refresh token), 3 (rate limit), 4 (lockout), 5 (verifikasi
email), 6 (password reset), 7 (password policy), 8 (JWT claims), 9 (logout
server-side), 10 (Google OAuth), 12 (audit log).

---

## Requirements (IMMUTABLE)

1. **Access token** JWT HS256 berumur **15 menit**, claims wajib:
   `sub`/user_id, `email`, `iss` (origin API), `aud`, `iat`, `exp`, `jti`.
   Role otorisasi **tetap disinkronkan dari database** (FR-ROLE dipertahankan).
2. **Refresh token**: random 256-bit, TTL **30 hari**, disimpan sebagai
   **hash SHA-256** di tabel `refresh_tokens`, **dirotasi** setiap penggunaan,
   dengan **reuse detection** (token lama yang dipakai lagi setelah rotasi →
   revoke seluruh session user).
3. Refresh token dikirim ke browser via cookie **httpOnly + Secure +
   SameSite=Lax**, `Path=/api/v1/auth`, host-only (tanpa `Domain=`).
4. Access token frontend disimpan **di memory (React state)** — **tidak pernah**
   di `localStorage`/`sessionStorage`. `hasToken()` route guard berubah menjadi
   cek session via query `/users` (atau setara).
5. CORS: `AllowCredentials: true` + `AllowOrigins` eksplisit (tidak `*`).
6. Endpoint baru: `POST /auth/refresh` (rotasi + set cookie baru) dan
   `POST /auth/logout` (revoke refresh token + hapus cookie).
7. **Rate limit** per IP pada seluruh route `/auth/*` (min: 10 req/menit untuk
   login/register/refresh) memakai rate limiter bawaan Echo.
8. **Account lockout**: 5 gagal berturut-turut → lock 15 menit (progressive:
   15m → 30m → 1h); counter reset saat login sukses. Kolom
   `failed_login_attempts` + `locked_until` di `users`.
9. **Email verification**: kolom `email_verified_at`; token verifikasi sekali
   pakai TTL 24 jam (hash SHA-256 di DB). Endpoint `POST /auth/verify-email`
   dan `POST /auth/resend-verification` (rate limited).
10. **Password reset**: `POST /auth/forgot-password` dengan respons seragam
    (anti email-enumeration); token reset sekali pakai TTL 1 jam (hash di DB);
    `POST /auth/reset-password` juga **revoke semua refresh token** user.
11. **Password policy**: min **8**, max **72** (batas bcrypt), tanpa aturan
    komposisi wajib (NIST SP 800-63B). Berlaku untuk password **baru**.
12. **Google OAuth** via `golang.org/x/oauth2` (alur PKCE). Akun dari Google
    dianggap `email_verified_at` terisi.
13. **Audit log**: tabel `audit_logs` (user_id nullable, action, detail jsonb,
    ip, user_agent). Event: `register`, `login_success`, `login_failed`,
    `login_locked`, `logout`, `refresh`, `verify_email`,
    `forgot_password`, `reset_password`, `google_login`, `role_change`.
14. **Email dikirim via SMTP** (`github.com/wneessen/go-mail`); saat env SMTP
    kosong (dev), email dicetak ke log console.
15. **Akun existing tidak boleh di-lock massal**: `email_verified_at` NULL
    tetap bisa login + banner verifikasi; password < 8 karakter tetap bisa
    login + prompt opsional perbarui password.
16. Seeder `promote_admin` idempotent: mencari `anas.muhammadakbar@gmail.com`
    (override via env `ADMIN_EMAIL`) lalu set role `admin`.

## Success Criteria (MUST ALL BE TRUE)

- [ ] `go test ./...` (API) dan test frontend lulus tanpa regresi
- [ ] `grep -r "localStorage" apps/platform/src` → tidak ada token/auth
- [ ] Unit test rotasi refresh + reuse detection (token lama setelah rotasi → revoke)
- [ ] Unit test rate limit & lockout (5 gagal → lock, reset saat sukses)
- [ ] Test verifikasi email & reset password memakai fake sender (tanpa SMTP nyata)
- [ ] Test Google OAuth callback (email → buat/link user, verified)
- [ ] Audit event tercatat untuk semua aksi di requirement 13
- [ ] Swagger docs endpoint baru diperbarui (refresh, logout, verify, resend,
      forgot/reset password, google)
- [ ] Seeder `promote_admin` berjalan idempotent (SKIP bila sudah admin)

## Anti-Patterns (FORBIDDEN)

- ❌ **NO localStorage/sessionStorage untuk token** (security: XSS → token dicuri; inilah gap #1 yang sedang diperbaiki)
- ❌ **NO access token berumur panjang tanpa refresh** (security: token bocor = akses penuh berjam-jam)
- ❌ **NO refresh token tanpa rotasi / tanpa reuse detection** (security: stolen refresh token dipakai selamanya)
- ❌ **NO refresh/verify/reset token disimpan plaintext di DB** (security: leak DB = token valid; wajib hash SHA-256)
- ❌ **NO token di URL/query param** (security: bocor via log/referrer)
- ❌ **NO JWT tanpa `iss`/`aud`/`jti`** (security: token lintas-aplikasi tidak bisa dibedakan/direvoke)
- ❌ **NO lockout massal akun existing** (UX: menghukum user lama atas kebijakan baru)
- ❌ **NO paksa reset password akun existing** (UX: tanpa lockout, prompt opsional)
- ❌ **NO blokir login user existing yang belum verified** (UX: keputusan final Q3 = banner)
- ❌ **NO mock Google OAuth di integration test** (validation: menguji alur nyata)
- ❌ **NO mengganti `JWT_SECRET` saat deploy** (compat: token lama harus tetap valid sampai exp)

## Approach

Refactor bertahap dengan fondasi model dulu (Task 1), lalu lapisan token
(backend → frontend), lalu proteksi (rate limit/lockout), lalu alur email
(verifikasi, reset), lalu Google OAuth, lalu audit & UI. Setiap task
mengikuti TDD repo (lihat docs/core/tdd.md) dan memakai pola
service-repository-handler yang sudah ada.

## Architecture

| Area | File (rencana) | Peran |
|---|---|---|
| Model | `model/user.go` | + kolom: `EmailVerifiedAt`, `FailedLoginAttempts`, `LockedUntil`, `PasswordChangedAt` |
| Model | `model/refresh_token.go` (baru) | Refresh token session |
| Model | `model/audit_log.go` (baru) | Audit trail |
| Token | `utility/token.go` (baru) | Issue/parse access JWT (claims lengkap) |
| Token | `utility/token.go` + `repository/refresh_token_repository.go` | Refresh: hash, rotasi, reuse detection |
| Handler | `handler/user_handler.go` | Login/register dirombak; + refresh, logout |
| Handler | `handler/auth_handler.go` (baru) | verify, resend, forgot, reset, google |
| Middleware | `middleware/auth.go` | Parse `iss`/`aud`/`jti`; cek revoked |
| Middleware | `middleware/rate_limit.go` (baru) | Rate limit /auth/* |
| Service | `service/user_service.go` | Lockout logic, password policy, verification |
| Service | `service/mailer.go` (baru) | SMTP via wneessen/go-mail; dev = log |
| Service | `service/audit_service.go` (baru) | Catat event audit |
| OAuth | `handler/oauth_handler.go` (baru) | Google PKCE |
| Config | `config/cors.go`, `config/env` | AllowCredentials, SMTP config |
| Seeder | `seeders/promote_admin/` (✅ selesai) | Promosi admin |
| Frontend | `features/auth/AuthContext.tsx` | Token di memory; interceptor refresh |

## Design Rationale

### Problem

Auth saat ini: JWT 24 jam di localStorage (gap #1 — XSS → token dicuri, valid
sehari penuh), tanpa refresh token, tanpa rate limit/lockout, tanpa verifikasi
email/reset password, password min 6 karakter, JWT minim claims, logout hanya
client-side, tanpa audit trail. Ini jauh di bawah standar OWASP ASVS / NIST.

### Research Findings

**Codebase:**
- `apps/api/middleware/auth.go:16-32` — `parseToken` validasi HMAC; belum ada iss/aud/jti/revoked check
- `apps/api/handler/user_handler.go:104-110` — token 24 jam tanpa refresh; secret dibaca tiap request (`auth.go:17`)
- `apps/api/middleware/auth.go:80-85` — role sync dari DB (FR-ROLE) → **dipertahankan**
- `apps/api/config/cors.go:96-106` — CORS tanpa `AllowCredentials` → wajib ditambah untuk cookie
- `apps/api/seeders/song_templates/main.go` — pola seeder (config.LoadEnv → DBInit → AutoMigrate) → diikuti `promote_admin`
- `apps/platform/src/features/auth/AuthContext.tsx:31-36` — `hasToken()` baca localStorage → dirombak
- `apps/api/go.mod` — `golang-jwt/jwt v3.2.2+incompatible` (v3 tua; upgrade v5 opsional bila perlu); `x/time` sudah ada (indirect) → rate limit siap

**Eksternal:**
- OWASP ASVS V3 — session mgmt: access short-lived + refresh rotate; V4 — rate limit & lockout
- NIST SP 800-63B — password: min 8, tanpa komposisi wajib; check breach list
- RFC 6749/9700 (OAuth 2.1) — PKCE untuk public client; rotate refresh tokens; reuse detection
- OWASP cheatsheet — cookie httpOnly+Secure+SameSite; hash token di DB
- `golang.org/x/oauth2` — Google OIDC; `github.com/wneessen/go-mail` — SMTP modern (menggantikan `net/smtp` yang verbose)

### Approaches Considered

#### 1. Access di memory + Refresh di httpOnly cookie ✓

**What it is:** Standar industri untuk SPA publik: access JWT 15 menit di React
state; refresh random 256-bit di httpOnly cookie; auto-refresh via interceptor.

**Pros:**
- Menutup gap #1 sepenuhnya (XSS tak bisa baca cookie, access cepat mati)
- Tanpa library session eksternal; sesuai pola codebase (Echo + GORM)
- Refresh dicabut server-side (logout, reset password) — gap #9

**Cons:**
- Satu dep baru (wneessen/go-mail) + perubahan CORS; perlu refactor frontend auth

**Chosen because:** Memenuhi requirement 1–6, 9; konsisten dengan arsitektur
SPA+API terpisah yang sudah ada (bandjari.net ↔ api.bandjari.net).

#### 2. BFF (Backend-for-Frontend) ❌

**What it is:** Access token disembunyikan di cookie session server-side;
frontend tidak pernah pegang JWT.

**Why we looked at:** Paling aman, menghilangkan semua XSS token exposure.

**Cons:**
- Perlu service/endpoint baru di depan API (atau nginx auth_request)
- Refactor besar frontend (semua panggilan lewat BFF)
- Overkill untuk app skala solo dev

**⚠️ REJECTED BECAUSE:** Kompleksitas > manfaat untuk skala proyek (Q2 = solo
dev). DO NOT REVISIT UNLESS: muncul banyak endpoint publik + tim > 3.

#### 3. Semua token di httpOnly cookie (session-style, tanpa access di memory) ❌

**What it is:** JWT sekaligus dikirim via cookie.

**Cons:**
- Butuh CSRF protection di semua mutasi
- Kehilangan keunggulan stateless JWT (harus validasi cookie tiap request)

**⚠️ REJECTED BECAUSE:** Menambah permukaan CSRF tanpa benefit nyata bagi
arsitektur saat ini. DO NOT REVISIT UNLESS: pindah ke pola session penuh.

### Scope Boundaries

**In scope:**
- Gap 1–10, 12 (sesuai pilihan user) + seeder admin
- Migrasi akun existing (kolom nullable, tanpa lockout massal)

**Out of scope (deferred/never):**
- ❌ Gap 11 MFA/2FA (TOTP/WebAuthn) — **tidak dipilih**; DO NOT REVISIT UNLESS user meminta
- ❌ Gap 13 Passkeys/FIDO2 — **tidak dipilih**; DO NOT REVISIT UNLESS user meminta
- ❌ Gap 14 sinkronisasi role di `OptionalAuth` — **tidak dipilih**; sudah ada komentar peringatan di `optional_auth.go`
- ❌ GitHub OAuth — Q2 pilih Google saja
- ❌ Manajemen role via UI — Q5 = assign manual OK
- ❌ Upgrade `golang-jwt/jwt` v3→v5 — hanya bila menyentuh token internals yang membutuhkannya

### Open Questions

- TTL cookie refresh vs DB expiry sinkronisasi (implementasi: cookie TTL ≤ DB TTL)
- Google OAuth: link akun existing by email aman karena email Google sudah verified — konfirmasi saat implementasi
- HIBP breach check: opsional, bisa ditinggalkan untuk batch pertama

## Design Discovery (Reference Context)

### Key Decisions Made

| Question | User Answer | Implication |
|---|---|---|
| Profil aplikasi? | Publik, open registration | Anti-spam: rate limit ketat, verifikasi email wajib |
| Skala tim? | Solo/1-2 dev | Hindari over-engineering (tanpa BFF, tanpa MFA dulu) |
| Prioritas? | Keamanan kritis + UX | Gap 1-9 + verifikasi/reset/OAuth |
| Dep eksternal? | Library OSS saja | wneessen/go-mail, x/oauth2 |
| Manajemen admin? | Manual + seeder | `seeders/promote_admin` untuk anas.muhammadakbar@gmail.com |
| Q1 Email provider? | SMTP (Brevo/SMTP2GO/Mailgun), dev=log | `service/mailer.go` dengan fallback console |
| Q2 OAuth? | Google saja | Satu provider, PKCE |
| Q3 Existing unverified? | Login + banner | Tidak blokir; kirim ulang verifikasi |
| Q4 Existing password lemah? | Login + prompt opsional | Tidak lockout massal |

### Research Deep-Dives

#### Refresh Token Rotation
**Question explored:** Pola mana yang aman & ringkas untuk SPA?
**Sumber:** RFC 9700 (OAuth 2.1), OWASP session cheatsheet.
**Temuan:** Rotasi tiap refresh + reuse detection (revoke semua session saat
token lama dipakai lagi) adalah standar minimum. Hash SHA-256 mencegah leak DB.
**Kesimpulan:** Diadopsi penuh di requirement 2.

#### Password Policy Modern
**Question explored:** Min 6 karakter sekarang masih diterima?
**Sumber:** NIST SP 800-63B, OWASP ASVS V2.
**Temuan:** Komposisi wajib (huruf besar/angka/simbol) justru tidak disarankan;
fokus panjang minimum 8 + cek breach. max 72 karena batas bcrypt.
**Kesimpulan:** Requirement 11.

#### Cookie cross-subdomain
**Question explored:** bandjari.net (FE) ↔ api.bandjari.net (API) bisa pakai
cookie httpOnly?
**Sumber:** MDN SameSite, RFC 6265.
**Temuan:** Beda subdomain masih **same-site** (registrable domain sama) —
SameSite=Lax tidak memblokir; `AllowCredentials: true` wajib di CORS.
**Kesimpulan:** Requirement 3 & 5; cookie host-only (tanpa Domain=) cukup.

### Dead-End Paths

#### BFF (Backend-for-Frontend)
**Why explored:** Standar keamanan tertinggi untuk SPA.
**Investigation:** Butuh layer proxy baru (nginx auth_request / service Go),
refactor semua panggilan FE, dan duplikasi otorisasi.
**Why abandoned:** Kompleksitas tidak sebanding skala solo dev; opsi 1 sudah
menutup gap #1.

### Open Concerns Raised

- "Bagaimana akun existing mengikuti standar?" → Requirement 15: kolom nullable,
  verified→banner, password lemah→prompt opsional, tanpa lockout massal;
  JWT_SECRET tidak berubah sehingga token lama tetap valid sampai exp.
- "Seeder admin harus aman" → idempotent (SKIP bila sudah admin), email bisa
  di-override via `ADMIN_EMAIL`, tidak menyentuh data lain.
