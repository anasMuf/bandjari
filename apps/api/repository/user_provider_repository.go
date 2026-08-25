package repository

import (
	"api/model"

	"gorm.io/gorm"
)

// UserProviderRepository — penyimpanan link provider OAuth (E-PROFILE-2026 R1).
// Logika penggunaan (match by subject, backfill, unlink guard) diuji lewat
// OAuthService dengan fake repo — konsisten dengan pola repository lain.
type UserProviderRepository interface {
	// FindByProviderSubject mencari link by (provider, provider_subject) —
	// basis match login Google V1-A.
	FindByProviderSubject(provider, subject string) (*model.UserProvider, error)
	// FindByUserIDAndProvider — cek apakah user sudah terhubung ke provider.
	FindByUserIDAndProvider(userID uint, provider string) (*model.UserProvider, error)
	// ListByUserID — seluruh provider yang terhubung ke user (untuk respons
	// GET /users: providers list).
	ListByUserID(userID uint) ([]model.UserProvider, error)
	// Create menyimpan link baru (idempotent dijamin unique index di DB).
	Create(link *model.UserProvider) error
	// Delete menghapus PERMANEN link (unlink). Hard delete disengaja: baris
	// mati tidak perlu dipertahankan (jejak ada di audit_logs) dan menghindari
	// konflik unique index bila user me-link ulang provider yang sama.
	Delete(userID uint, provider string) error
	// DeleteAllByUserID menghapus PERMANEN seluruh link provider user — dipakai
	// delete account (E-PROFILE-2026 R12): mencegah akun Google yang pernah
	// terhubung terkunci permanen (review finding #2).
	DeleteAllByUserID(userID uint) error
}

type userProviderRepository struct {
	db *gorm.DB
}

func NewUserProviderRepository(db *gorm.DB) UserProviderRepository {
	return &userProviderRepository{db: db}
}

func (r *userProviderRepository) FindByProviderSubject(provider, subject string) (*model.UserProvider, error) {
	var link model.UserProvider
	err := r.db.Where("provider = ? AND provider_subject = ?", provider, subject).First(&link).Error
	return &link, err
}

func (r *userProviderRepository) FindByUserIDAndProvider(userID uint, provider string) (*model.UserProvider, error) {
	var link model.UserProvider
	err := r.db.Where("user_id = ? AND provider = ?", userID, provider).First(&link).Error
	return &link, err
}

func (r *userProviderRepository) ListByUserID(userID uint) ([]model.UserProvider, error) {
	var links []model.UserProvider
	err := r.db.Where("user_id = ?", userID).Find(&links).Error
	return links, err
}

func (r *userProviderRepository) Create(link *model.UserProvider) error {
	return r.db.Create(link).Error
}

func (r *userProviderRepository) Delete(userID uint, provider string) error {
	// Unscoped: hard delete — lihat komentar interface.
	return r.db.Unscoped().Where("user_id = ? AND provider = ?", userID, provider).Delete(&model.UserProvider{}).Error
}

func (r *userProviderRepository) DeleteAllByUserID(userID uint) error {
	// Unscoped: hard delete — lihat komentar interface.
	return r.db.Unscoped().Where("user_id = ?", userID).Delete(&model.UserProvider{}).Error
}
