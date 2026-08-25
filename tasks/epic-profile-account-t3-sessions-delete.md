# Task 3: Sesi Aktif + Delete Account

> **Epic:** E-PROFILE-2026 (docs/core/epic-profile-account.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-25)

## Goal

Dua fitur pengelolaan akun backend:
1. **Kelola sesi aktif** — `GET /auth/sessions` (daftar device: user_agent, ip,
   waktu, flag "sesi ini") & `POST /auth/sessions/:id/revoke` (putus satu sesi).
2. **Delete account** — `POST /auth/delete-account` (konfirmasi password,
   soft delete + anonimisasi email + cascade soft-delete konten + revoke semua
   sesi + hapus row `user_providers` + audit).

## Implementasi

### 1. Study existing code dulu

- `model/refresh_token.go` — `UserAgent` + `IP` + `ExpiresAt` (fondasi daftar sesi)
- `repository/refresh_token_repository.go` — pola repo; tambah
  `ListActiveByUserID`, `FindByID` (untuk revoke by id + cek kepemilikan)
- `repository/user_provider_repository.go` — tambah `DeleteAllByUserID`
  (review finding #2: wajib bersihkan provider saat hapus akun)
- `repository/song_repository.go:112-129` — cascade soft-delete
  (`DeleteSectionsBySongID` dkk) + `ListByUserID` (exclude template sistem)
- `repository/sample_repository.go` — `ListByUserID` + `Delete`
- `service/token_service.go` — TokenService pemilik siklus hidup refresh token;
  tambah method daftar/revoke sesi
- `service/user_service.go` — tambah `DeleteAccount`; userRepo perlu `Delete`
  (soft delete via GORM) untuk anonymize + soft delete user
- `handler/user_handler.go` — pola handler + `recordAudit` + cookie refresh
- `main.go:166-172` — grup `auth` (jwtAuth)

### 2. Tulis test dulu (TDD)

**`service/token_service_test.go`:**
- `ListActiveSessions`: hanya sesi aktif (non-revoked, non-expired) yang tampil;
  `current` = true hanya untuk hash yang cocok; urut konsisten
- `RevokeSessionByID`: sesi user lain → error (bukan 404/403)? → diputus;
  sesi tidak ada → `ErrNotFound`

**`service/user_service_test.go`:**
- `DeleteAccount`: password salah → `ErrInvalidCredentials` (tidak ada yang
  dihapus); sukses → user soft-delete + email `deleted-{id}@bandjari.local` +
  name "Akun Terhapus" + provider rows hilang + semua refresh token revoked +
  song/sample user ikut soft-delete; Google-only tanpa password → sukses tanpa
  verifikasi

### 3. Checklist implementasi

- [x] `repository/refresh_token_repository.go` — `ListActiveByUserID(userID)`,
      `FindByID(id)` (+ fake di `token_service_test.go`)
- [x] `repository/user_provider_repository.go` — `DeleteAllByUserID(userID)`
- [x] `repository/user_repository.go` — `Delete(userID uint) error` (soft
      delete via GORM)
- [x] `service/token_service.go` — `ListActiveSessions(userID, currentHash)`
      (mengembalikan `[]dto.SessionResponse`), `RevokeSessionByID(userID, id)`
      (ownership enforced → ErrNotFound)
- [x] `service/user_service.go` — `DeleteAccount(userID, password)`:
      verifikasi password bila ada; revoke sesi; hapus provider rows;
      cascade soft-delete konten; anonymize + soft delete user;
      `UserService` + deps songRepo/sampleRepo
- [x] `dto/session.go` — `SessionResponse{id, user_agent, ip, created_at,
      expires_at, current}`
- [x] `dto/user.go` — `DeleteAccountRequest{Password}` (opsional untuk
      Google-only)
- [x] `handler/user_handler.go` — `ListSessions`, `RevokeSession`, `DeleteAccount`
      + `recordAudit` (`session_revoke`, `account_delete`)
- [x] `service/audit_service.go` — `ActionSessionRevoke`, `ActionAccountDelete`
- [x] `main.go` — route: `auth.GET("/auth/sessions")`,
      `auth.POST("/auth/sessions/:id/revoke")`,
      `auth.POST("/auth/delete-account")`
- [x] Swagger & client Orval di-regenerate

## Success Criteria

- [x] `go test ./...` lulus (test baru + lama hijau)
- [x] Session list: hanya sesi aktif; flag `current` benar; revoke by id
      menghormati kepemilikan (sesi user lain ditolak)
- [x] Delete account: password salah ditolak; sukses → soft delete +
      anonimisasi email + provider rows hilang (review finding #2) + konten
      user soft-deleted + template sistem TIDAK tersentuh + audit tercatat
- [x] `go vet` & `go build` bersih; Swagger + Orval regenerated;
      tsc + biome + vitest hijau
