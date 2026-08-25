# Task 2: Keamanan Akun — Edit Nama + Change/Set Password

> **Epic:** E-PROFILE-2026 (docs/core/epic-profile-account.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-25)

## Goal

Endpoint pengelolaan akun (bagian Keamanan halaman Profile):
1. `PATCH /users` — edit nama (keputusan Q2-A: nama saja, bukan email/avatar).
2. `POST /auth/change-password` — ganti password: wajib password lama (OWASP
   re-auth), policy NIST (min 8, maks 72), update `password_changed_at`,
   **revoke semua sesi KECUALI current** (keputusan Q3-A).
3. `POST /auth/set-password` — set password untuk akun Google-only (tanpa
   password) — prasyarat unlink Google (Task 1). Guard: akun yang SUDAH punya
   password ditolak (pakai change-password).

Audit event baru: `profile_update`, `password_change`.

## Implementasi

### 1. Study existing code dulu

- `service/password_reset_service.go` — pola revoke semua sesi + policy password
  di SERVICE (defense in depth); `userRepo.Save` untuk update
- `service/user_service.go` + `service/user_service_test.go` — pola service
  + fake repo (`fakeUserRepo.FindByID` saat ini stub → perlu update agar
  men-support ID lookup)
- `repository/refresh_token_repository.go` + `service/token_service_test.go`
  (`fakeRefreshRepo`) — tambah `RevokeAllByUserIDExcept`
- `handler/user_handler.go` — pola handler + `recordAudit` + `c.Get("user_id")`
- `dto/user.go` — pola DTO + validate tag
- `main.go:166-171` — grup `auth` (jwtAuth) untuk route baru
- `utility/RefreshTokenCookieName` — untuk ambil sesi current di handler

### 2. Tulis test dulu (TDD)

**`service/user_service_test.go`:**
- `UpdateProfile`: nama berubah + respons sesuai; user tidak ada →
  `ErrUserNotFound`
- `ChangePassword`: password lama salah → `ErrInvalidCredentials` (hash TIDAK
  berubah); sukses → hash baru + `PasswordChangedAt` terisi + sesi lain
  direvoke kecuali current; akun tanpa password → `ErrNoPassword`;
  password lemah → `ErrWeakPassword` (state user tidak berubah)
- `SetPassword`: sukses (hash + `PasswordChangedAt` + revoke kecuali current);
  akun sudah punya password → `ErrPasswordAlreadySet`

**`service/token_service_test.go` / repo test:** `RevokeAllByUserIDExcept`
mencabut semua kecuali token yang di-keep.

### 3. Checklist implementasi

- [x] `dto/user.go` — `UpdateUserRequest{Name}`, `ChangePasswordRequest{
      CurrentPassword, NewPassword}`, `SetPasswordRequest{NewPassword}` +
      validate tag (password min 8 maks 72)
- [x] `service/errors.go` — `ErrNoPassword`, `ErrPasswordAlreadySet`
- [x] `service/audit_service.go` — `ActionProfileUpdate`, `ActionPasswordChange`
- [x] `repository/refresh_token_repository.go` — `RevokeAllByUserIDExcept(
      userID, keepTokenHash)` (+ impl + fake di test)
- [x] `service/user_service.go` — `UpdateProfile(userID, name)`,
      `ChangePassword(userID, current, new, keepRefreshRaw)`,
      `SetPassword(userID, new, keepRefreshRaw)`; userService + refreshRepo
      (untuk revoke kecuali current); policy password di service
- [x] `handler/user_handler.go` — `UpdateUser` (PATCH /users), `ChangePassword`,
      `SetPassword`; ambil `user_id` dari context + cookie refresh current;
      map error → HTTP; `recordAudit`
- [x] `main.go` — route: `auth.PATCH("/users")`,
      `auth.POST("/auth/change-password")`, `auth.POST("/auth/set-password")`
- [x] Swagger & client Orval di-regenerate

## Success Criteria

- [x] `go test ./...` lulus (test baru + lama hijau)
- [x] Change-password: password lama salah ditolak; sukses → revoke sesi lain,
      sesi current TETAP hidup; `password_changed_at` terisi
- [x] Set-password: hanya untuk akun tanpa password; sukses → akun bisa unlink
      Google (guard Task 1 tidak lagi memblokir)
- [x] Edit nama: hanya nama yang berubah (email/role tidak tersentuh)
- [x] `go vet` & `go build` bersih; audit `profile_update`/`password_change`
      tercatat; Swagger + Orval regenerated (tsc + biome + vitest 108 hijau)
