package repository

import (
	"api/model"

	"gorm.io/gorm"
)

type UserRepository interface {
	FindByEmail(email string) (*model.User, error)
	FindByID(id uint) (*model.User, error)
	Create(req *model.User) error
	// Save memperbarui seluruh kolom user — dipakai lockout (failed attempts,
	// locked_until) dan reset counter saat login sukses (E-AUTH-2026 R8).
	Save(user *model.User) error
	// FindByVerificationTokenHash / FindByResetTokenHash — lookup by kode
	// sekali pakai (hash SHA-256), agar verifikasi/reset cukup memakai kode
	// tanpa email di URL (E-AUTH-2026 R9/R10).
	FindByVerificationTokenHash(hash string) (*model.User, error)
	FindByResetTokenHash(hash string) (*model.User, error)
	// Delete — soft delete (gorm.DeletedAt di BaseModel). Dipakai delete
	// account setelah email/name dianonimkan (E-PROFILE-2026 R12).
	Delete(userID uint) error
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{
		db: db,
	}
}

func (r *userRepository) FindByEmail(email string) (*model.User, error) {
	var user model.User
	err := r.db.Where("email = ?", email).First(&user).Error
	return &user, err
}

func (r *userRepository) FindByID(id uint) (*model.User, error) {
	var user model.User
	err := r.db.First(&user, id).Error
	return &user, err
}

func (r *userRepository) Create(req *model.User) error {
	return r.db.Create(req).Error
}

func (r *userRepository) Save(user *model.User) error {
	return r.db.Save(user).Error
}

func (r *userRepository) FindByVerificationTokenHash(hash string) (*model.User, error) {
	var user model.User
	err := r.db.Where("verification_token_hash = ?", hash).First(&user).Error
	return &user, err
}

func (r *userRepository) FindByResetTokenHash(hash string) (*model.User, error) {
	var user model.User
	err := r.db.Where("reset_token_hash = ?", hash).First(&user).Error
	return &user, err
}

func (r *userRepository) Delete(userID uint) error {
	return r.db.Delete(&model.User{}, userID).Error
}
