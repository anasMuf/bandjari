package model

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
}

func (User) TableName() string {
	return "users"
}
