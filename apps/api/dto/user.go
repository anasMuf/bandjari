package dto

type UserResponse struct {
	ID       uint    `json:"id"`
	FullName string  `json:"full_name"`
	Username string  `json:"username"`
	Email    string  `json:"email"`
	Phone    string  `json:"phone"`
	Address  string  `json:"address"`
	Role     string  `json:"role"`
	Deposit  float64 `json:"deposit"`
}

type CreateUserRequest struct {
	FullName string `json:"full_name" validate:"required,min=3,max=100"`
	Username string `json:"username" validate:"required,min=3,max=50"`
	Email    string `json:"email" validate:"required,email,max=100"`
	Password string `json:"password" validate:"required,min=6,max=100"`
	Phone    string `json:"phone" validate:"required,max=15"`
	Address  string `json:"address" validate:"required"`
}

type LoginUserRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginUserResponse struct {
	Token string `json:"token"`
}
