package model

type User struct {
	PrimaryKey
	FullName string `json:"full_name" gorm:"type:varchar(100);not null"`
	Email    string `json:"email" gorm:"type:varchar(100);not null;unique"`
	// password not shown in response
	Password string `json:"password,omitempty" gorm:"type:varchar(100);not null"`

	Username string  `json:"username" gorm:"type:varchar(50);not null;unique"`
	Phone    string  `json:"phone" gorm:"type:varchar(15);not null"`
	Address  string  `json:"address" gorm:"type:text;not null"`
	Role     string  `json:"role" gorm:"type:varchar(20);not null;default:'customer'"`
	Deposit  float64 `json:"deposit" gorm:"type:decimal(15,2);default:0"`
	BaseModelTimeAt
}

func (User) TableName() string {
	return "users"
}
