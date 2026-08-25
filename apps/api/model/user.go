package model

import "time"

// Role pengguna dalam sistem.
type Role string

const (
	// RoleAdmin boleh mengelola data System Template (Song & Sample).
	RoleAdmin Role = "admin"
	// RoleUser (default) hanya boleh mengelola data miliknya sendiri.
	RoleUser Role = "user"
)

type User struct {
	BaseModel
	Name         string `json:"name" gorm:"type:varchar(255);not null"`
	Email        string `json:"email" gorm:"type:varchar(255);not null;unique"`
	PasswordHash string `json:"-" gorm:"column:password_hash;type:varchar(255);not null"`
	// Role: "admin" | "user" (default). Penugasan manual lewat database untuk sekarang.
	Role string `json:"role" gorm:"type:varchar(16);not null;default:user"`
	// EmailVerifiedAt terisi setelah user mengonfirmasi email (E-AUTH-2026 R9).
	// Nilai NULL = belum diverifikasi — akun existing tetap bisa login (keputusan Q3).
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty" gorm:"column:email_verified_at"`
	// PasswordChangedAt dicatat untuk mendeteksi password lama/lemah (E-AUTH-2026 R11).
	PasswordChangedAt *time.Time `json:"password_changed_at,omitempty" gorm:"column:password_changed_at"`
	// FailedLoginAttempts & LockedUntil dipakai account lockout (E-AUTH-2026 R8).
	// json:"-" — field internal keamanan, tidak boleh bocor ke respons API.
	FailedLoginAttempts int        `json:"-" gorm:"column:failed_login_attempts;not null;default:0"`
	LockedUntil         *time.Time `json:"-" gorm:"column:locked_until"`
	// VerificationTokenHash & VerificationExpiresAt — kode verifikasi email
	// sekali pakai, TTL 24 jam (E-AUTH-2026 R9). Hanya hash yang disimpan.
	VerificationTokenHash string     `json:"-" gorm:"column:verification_token_hash;type:char(64)"`
	VerificationExpiresAt *time.Time `json:"-" gorm:"column:verification_expires_at"`
	// VerificationSentAt — waktu pengiriman email verifikasi terakhir, untuk
	// cooldown anti-spam (60 detik) per alamat (E-AUTH-2026 R9).
	VerificationSentAt *time.Time `json:"-" gorm:"column:verification_sent_at"`
	// ResetTokenHash & ResetExpiresAt — kode reset password sekali pakai,
	// TTL 1 jam (E-AUTH-2026 R10). Hanya hash yang disimpan.
	ResetTokenHash string     `json:"-" gorm:"column:reset_token_hash;type:char(64)"`
	ResetExpiresAt *time.Time `json:"-" gorm:"column:reset_expires_at"`
	// ResetSentAt — waktu pengiriman email reset terakhir, untuk cooldown
	// anti-spam (60 detik) per alamat (review E-AUTH-2026).
	ResetSentAt *time.Time `json:"-" gorm:"column:reset_sent_at"`
}

func (User) TableName() string {
	return "users"
}
