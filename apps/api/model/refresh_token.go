package model

import "time"

// RefreshToken merepresentasikan satu session login (E-AUTH-2026 R2).
// Hanya hash SHA-256 dari token acak yang disimpan — plaintext token TIDAK
// pernah masuk database (anti-pattern epic: NO plaintext token).
type RefreshToken struct {
	BaseModel
	UserID uint `json:"user_id" gorm:"not null;index"`
	// TokenHash = SHA-256 hex dari refresh token acak (64 char). Unik — satu
	// token hanya boleh dipakai sekali.
	TokenHash string     `json:"-" gorm:"column:token_hash;type:char(64);not null;uniqueIndex"`
	ExpiresAt time.Time  `json:"expires_at" gorm:"not null;index"`
	RevokedAt *time.Time `json:"revoked_at,omitempty" gorm:"index"`
	// ReplacedByID menunjuk refresh token baru hasil rotasi (R2). Dipakai
	// reuse detection: token yang sudah dirotasi tapi masih dipakai ulang
	// menandakan pencurian → seluruh session user direvoke.
	ReplacedByID *uint  `json:"replaced_by_id,omitempty" gorm:"column:replaced_by_id"`
	UserAgent    string `json:"user_agent,omitempty" gorm:"type:varchar(255)"`
	IP           string `json:"ip,omitempty" gorm:"type:varchar(45)"`
	User         User   `json:"-" gorm:"constraint:OnDelete:CASCADE"`
}

func (RefreshToken) TableName() string {
	return "refresh_tokens"
}
