package model

type User struct {
	BaseModel
	Name         string `json:"name" gorm:"type:varchar(255);not null"`
	Email        string `json:"email" gorm:"type:varchar(255);not null;unique"`
	PasswordHash string `json:"-" gorm:"column:password_hash;type:varchar(255);not null"`
}

func (User) TableName() string {
	return "users"
}
