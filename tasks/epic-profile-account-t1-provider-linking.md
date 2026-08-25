# Task 1: Fondasi Provider Linking — Model `user_providers` + Refactor OAuth (V1-A)

> **Epic:** E-PROFILE-2026 (docs/core/epic-profile-account.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-24)

## Goal

Fondasi backend untuk "Akun terhubung": tabel `user_providers`, refactor
perilaku login Google (match by `provider_subject`, fallback email hanya untuk
akun tanpa password, backfill akun legacy, tolak akun ber-password yang belum
link), plus endpoint link/unlink Google + audit event. Ini slice paling berisiko
(keputusan V1-A) — divalidasi duluan sebelum UI dibangun.

## Implementasi

### 1. Study existing code dulu

- `model/base.go` + `model/user.go` — pola BaseModel (soft delete sudah ada)
- `service/oauth_service.go` + `service/oauth_service_test.go` — perilaku saat
  ini (match by email saja) + pola test dengan `fakeTokenUserRepo`
- `handler/oauth_handler.go` — alur callback; `googleUserinfo` belum punya `sub`
- `repository/user_repository.go` — pola repository + interface
- `service/audit_service.go` — konstanta action; tambah 3 event baru
- `middleware/auth.go:95` — context `user_id` dari DB (untuk handler link/unlink)
- `main.go:149-162` — route auth; tambah route baru di sini
- `service/token_service_test.go:14-63` — fake repo pattern (tambahkan method
  baru ke `fakeTokenUserRepo` agar tetap implement `UserRepository`)

### 2. Tulis test dulu (TDD)

**`model/user_provider.go`** — struktur `UserProvider` (TableName
`user_providers`, field sesuai requirement 1 epic).

**`service/oauth_service_test.go` — update + tambah:**
- Match by `(provider, provider_subject)` → akun dipakai, walau email di info
  Google berbeda dari akun.
- Email cocok + akun **tanpa password** → auto-link + backfill row provider,
  login lanjut, `EmailVerifiedAt` diisi bila Google confirm.
- Email cocok + akun **punya password** → error `ErrSocialLinkRequired`
  (tanpa membuat row provider).
- Email tidak terdaftar → akun baru + row provider dibuat.
- Google info `EmailVerified: false` → akun tetap unverified (tidak diisi).
- `LinkProvider(userID, provider, subject)`: menambah row provider (idempotent
  — tidak duplikat bila sudah ada).
- `UnlinkProvider(userID, provider)`: menghapus row provider; **ditolak** bila
  user tidak punya password dan tidak punya provider lain (error
  `ErrLastLoginMethod`).

**`handler/oauth_handler_test.go`** (bila ada — kalau tidak, cukup via service):
- Callback dengan mode link (`link=1` + refresh cookie valid) → row provider
  dibuat untuk user sesi aktif, redirect `/profile`.
- Callback mode link tanpa login → redirect `/login`.
- Login Google akun ber-password tanpa link → redirect `/login?error=google-link`.

### 3. Checklist implementasi

**Backend:**
- [x] `model/user_provider.go` — `UserProvider` + `TableName()` +
      `AutoMigrate(&model.UserProvider{})` di `main.go:50`
- [x] `repository/user_provider_repository.go` — interface + impl:
      `FindByProviderSubject`, `FindByUserIDAndProvider`, `ListByUserID`,
      `Create`, `Delete` (hard delete via `Unscoped`)
- [x] `repository/user_repository.go` — tidak diubah (provider via repo terpisah)
- [x] `service/oauth_service.go` — refactor `LoginOrCreateUser` (V1-A),
      `LinkProvider` (idempotent + `ErrProviderTaken`), `UnlinkProvider`
      (guard `ErrLastLoginMethod`); `GoogleUserInfo.ProviderSubject`
- [x] `service/audit_service.go` — + `ActionProviderLink`, `ActionProviderUnlink`
- [x] `handler/oauth_handler.go` — `googleUserinfo.Id`; mode link (`?link=1` →
      state prefix `link:` + validasi refresh cookie); redirect
      `/login?error=google-link` saat `ErrSocialLinkRequired`;
      `DELETE /auth/providers/google` (UnlinkGoogle) + `recordAudit`
- [x] `main.go` — wiring provider repo + route unlink
- [x] Update `dto/user.go` — `UserResponse` + `HasPassword` + `Providers`
      (diisi service: `userService.userProviders`)

## Success Criteria

- [x] `go test ./...` lulus — test lama OAuth (4) tetap hijau setelah refactor
- [x] Test baru: subject match, fallback passwordless + backfill, tolak akun
      ber-password (`ErrSocialLinkRequired`), akun baru + provider row,
      link idempotent, unlink guard `ErrLastLoginMethod` (total 8 test OAuth +
      2 test user response)
- [x] `go vet` & `go build` bersih
- [x] `GET /users` mengembalikan `has_password` + `providers` yang benar
- [x] Audit `provider_link` / `provider_unlink` tercatat (best-effort)
- [x] Akun existing Google-only tetap bisa login (backfill) — tidak ada
      lockout massal
- [x] Swagger & client Orval di-regenerate; `tsc` + `biome lint` + `vitest`
      (108 test) hijau
