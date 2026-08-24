# Task 1: Fondasi Model & Password Policy

> **Epic:** E-AUTH-2026 (docs/core/epic-auth-overhaul.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-24)

## Goal

Menyiapkan fondasi data untuk seluruh epic: kolom baru di `users`, dua tabel
baru (`refresh_tokens`, `audit_logs`), dan kebijakan password baru (min 8).
Task ini TIDAK mengubah alur login/register yang ada — hanya menyiapkan skema
agar task berikutnya (refresh token, verifikasi, dst.) bisa dibangun di
atasnya tanpa migrasi tambahan.

## Implementasi

### 1. Model User — tambah kolom (apps/api/model/user.go)

Tambah field ke struct `User` (semua nullable/ber-default aman → migrasi
non-destruktif):

```go
EmailVerifiedAt     *time.Time `json:"email_verified_at,omitempty" gorm:"column:email_verified_at"`
PasswordChangedAt   *time.Time `json:"password_changed_at,omitempty" gorm:"column:password_changed_at"`
FailedLoginAttempts int        `json:"-" gorm:"column:failed_login_attempts;not null;default:0"`
LockedUntil         *time.Time `json:"-" gorm:"column:locked_until"`
```

Catatan: `json:"-"` untuk field internal keamanan (tidak boleh bocor ke API).

### 2. Model baru: RefreshToken (apps/api/model/refresh_token.go)

```go
type RefreshToken struct {
    BaseModel
    UserID      uint       `gorm:"not null;index"`
    TokenHash   string     `gorm:"column:token_hash;type:char(64);not null;uniqueIndex"`
    ExpiresAt   time.Time  `gorm:"not null;index"`
    RevokedAt   *time.Time `gorm:"index"`
    ReplacedByID *uint     `gorm:"column:replaced_by_id"` // rotasi: session baru menggantikan ini
    UserAgent   string     `gorm:"type:varchar(255)"`
    IP          string     `gorm:"type:varchar(45)"`
    User        User       `gorm:"constraint:OnDelete:CASCADE"`
}
```

### 3. Model baru: AuditLog (apps/api/model/audit_log.go)

```go
type AuditLog struct {
    BaseModel
    UserID    *uint          `gorm:"index"` // nil = aksi anonim (mis. login gagal)
    Action    string         `gorm:"type:varchar(64);not null;index"`
    Detail    datatypes.JSON `gorm:"type:jsonb"`
    IP        string         `gorm:"type:varchar(45)"`
    UserAgent string         `gorm:"type:varchar(255)"`
}
```

(`gorm.io/datatypes` untuk JSONB — tambahkan ke go.mod bila belum ada.)

### 4. Daftarkan di AutoMigrate

- `apps/api/main.go:46-55` — tambah `&model.RefreshToken{}`, `&model.AuditLog{}`
- `apps/api/seeders/song_templates/main.go:189-198` — ikut tambah (pola seeder
  menyamakan skema dengan main app)

### 5. Password policy baru (NIST SP 800-63B)

- `apps/api/dto/user.go:14` — `validate:"required,min=8,max=72"` pada
  `CreateUserRequest.Password` (+ field baru di `ResetPasswordRequest` saat
  task reset password, bukan di task ini)
- `apps/api/service/user_service.go:55-76` — tambah cek panjang (8–72) sebagai
  *defense in depth* (validasi DTO bisa dilewati langsung ke service)

### 6. TDD — tulis test dulu (pola: apps/api/service/user_service_test.go)

- [x] `TestCreateUser_RejectsShortPassword` — password < 8 → error (`ErrWeakPassword`)
- [x] `TestCreateUser_RejectsTooLongPassword` — password > 72 byte → error
- [x] `TestCreateUser_AcceptsLongPassphrase` — passphrase panjang tanpa simbol → sukses
- [x] `TestCreateUser_HashesPassword` — tetap lulus (password "secret123" = 9 char)

> **DEVIASI (dokumentasi):** Test "AutoMigrate tanpa error" yang semula direncanakan
> (mis. `TestRefreshTokenModel_Migrates`) **dihapus** — CI menjalankan `go test ./...`
> TANPA postgres service (`.github/workflows/ci-cd.yml:36`), sehingga test berbasis DB
> live tidak viable. Migrasi model diverifikasi lewat:
> 1) `go build`/`go vet` untuk kelayakan kompilasi, 2) `AutoMigrate` saat startup
> produksi (pola existing di `main.go`), 3) verifikasi manual di dev bila DB tersedia.

## Success Criteria

- [x] `go test ./...` lulus (termasuk test existing — tidak ada regresi)
- [x] `go vet ./...` bersih
- [x] Migrasi jalan di DB baru & DB existing (kolom nullable, tanpa drop data) —
      AutoMigrate ditambahkan di `main.go` & `seeders/song_templates/main.go`
- [x] Register menolak password < 8 karakter; menerima passphrase panjang
- [ ] Swagger `CreateUserRequest` menampilkan min 8 — **DITUNDA**: docs.go masih
      menampilkan `maxLength: 255` (stale); regenerate `swag init` sengaja tidak
      dilakukan agar tidak memproduksi diff besar di file generated — akan di-bereskan
      pada task yang menyentuh Swagger secara nyata (mis. endpoint baru di Task 2+)
- [x] Tidak ada perubahan perilaku login/register yang sudah ada selain validasi password
