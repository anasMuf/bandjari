package repository

import (
	"api/model"
	"time"

	"gorm.io/gorm"
)

// RefreshTokenRepository — penyimpanan refresh token (E-AUTH-2026 R2).
// Logika penggunaan (rotasi, reuse detection) diuji lewat TokenService
// dengan fake repo — konsisten dengan pola repository lain yang tidak
// memiliki unit test DB langsung.
type RefreshTokenRepository interface {
	Create(token *model.RefreshToken) error
	FindByTokenHash(hash string) (*model.RefreshToken, error)
	// Rotate merevoke token lama & menyimpan pengganti hasil rotasi — atomik
	// (transaksi): keduanya tidak boleh berhasil separuh.
	Rotate(old *model.RefreshToken, replacement *model.RefreshToken) error
	// Revoke mencabut satu token (logout) — idempotent bila sudah dicabut.
	Revoke(token *model.RefreshToken) error
	// RevokeAllByUserID merevoke seluruh session user yang masih aktif —
	// dipakai logout semua perangkat & reuse detection (E-AUTH-2026 R2).
	RevokeAllByUserID(userID uint) error
}

type refreshTokenRepository struct {
	db *gorm.DB
}

func NewRefreshTokenRepository(db *gorm.DB) RefreshTokenRepository {
	return &refreshTokenRepository{db: db}
}

func (r *refreshTokenRepository) Create(token *model.RefreshToken) error {
	return r.db.Create(token).Error
}

func (r *refreshTokenRepository) FindByTokenHash(hash string) (*model.RefreshToken, error) {
	var token model.RefreshToken
	err := r.db.Where("token_hash = ?", hash).First(&token).Error
	return &token, err
}

func (r *refreshTokenRepository) Rotate(old *model.RefreshToken, replacement *model.RefreshToken) error {
	now := time.Now()
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(replacement).Error; err != nil {
			return err
		}
		return tx.Model(&model.RefreshToken{}).
			Where("id = ? AND revoked_at IS NULL", old.ID).
			Updates(map[string]interface{}{
				"revoked_at":     now,
				"replaced_by_id": replacement.ID,
			}).Error
	})
}

func (r *refreshTokenRepository) Revoke(token *model.RefreshToken) error {
	return r.db.Model(&model.RefreshToken{}).
		Where("id = ? AND revoked_at IS NULL", token.ID).
		Update("revoked_at", time.Now()).Error
}

func (r *refreshTokenRepository) RevokeAllByUserID(userID uint) error {
	return r.db.Model(&model.RefreshToken{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", time.Now()).Error
}
