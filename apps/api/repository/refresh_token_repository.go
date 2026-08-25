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
	// FindByID — untuk revoke by id & verifikasi kepemilikan (kelola sesi).
	FindByID(id uint) (*model.RefreshToken, error)
	// ListActiveByUserID — seluruh sesi aktif (non-revoked, non-expired) user.
	ListActiveByUserID(userID uint) ([]model.RefreshToken, error)
	// Rotate merevoke token lama & menyimpan pengganti hasil rotasi — atomik
	// (transaksi): keduanya tidak boleh berhasil separuh.
	Rotate(old *model.RefreshToken, replacement *model.RefreshToken) error
	// Revoke mencabut satu token (logout) — idempotent bila sudah dicabut.
	Revoke(token *model.RefreshToken) error
	// RevokeAllByUserID merevoke seluruh session user yang masih aktif —
	// dipakai logout semua perangkat & reuse detection (E-AUTH-2026 R2).
	RevokeAllByUserID(userID uint) error
	// RevokeAllByUserIDExcept merevoke seluruh session user KECUALI satu token
	// hash (sesi current) — dipakai ganti/set password (E-PROFILE-2026 R7/R8):
	// sesi lain mati, sesi yang sedang dipakai tetap hidup.
	RevokeAllByUserIDExcept(userID uint, keepTokenHash string) error
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

func (r *refreshTokenRepository) FindByID(id uint) (*model.RefreshToken, error) {
	var token model.RefreshToken
	err := r.db.First(&token, id).Error
	return &token, err
}

func (r *refreshTokenRepository) ListActiveByUserID(userID uint) ([]model.RefreshToken, error) {
	var tokens []model.RefreshToken
	err := r.db.Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", userID, time.Now()).
		Order("created_at DESC").Find(&tokens).Error
	return tokens, err
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

func (r *refreshTokenRepository) RevokeAllByUserIDExcept(userID uint, keepTokenHash string) error {
	return r.db.Model(&model.RefreshToken{}).
		Where("user_id = ? AND revoked_at IS NULL AND token_hash <> ?", userID, keepTokenHash).
		Update("revoked_at", time.Now()).Error
}
