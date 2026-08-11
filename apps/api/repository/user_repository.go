package repository

import (
	"api/model"

	"gorm.io/gorm"
)

type UserRepository interface {
	FindByEmail(email string) (*model.User, error)
	FindByUsername(username string) (*model.User, error)
	Create(req *model.User) error
	UpdateDeposit(userID uint, amount float64) error
	UpdateMinDeposit(userID uint, amount float64) error
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

func (r *userRepository) FindByUsername(username string) (*model.User, error) {
	var user model.User
	err := r.db.Where("username = ?", username).First(&user).Error
	return &user, err
}

func (r *userRepository) Create(req *model.User) error {
	return r.db.Create(req).Error
}

func (r *userRepository) UpdateDeposit(userID uint, amount float64) error {
	return r.db.Model(&model.User{}).Where("id = ?", userID).Update("deposit", gorm.Expr("deposit + ?", amount)).Error
}

func (r *userRepository) UpdateMinDeposit(userID uint, amount float64) error {
	return r.db.Model(&model.User{}).Where("id = ?", userID).Update("deposit", amount).Error
}
