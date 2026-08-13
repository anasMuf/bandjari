package dto

type UserResponse struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type CreateUserRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=255"`
	Email    string `json:"email" validate:"required,email,max=255"`
	Password string `json:"password" validate:"required,min=6,max=255"`
}

type LoginUserRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginUserResponse struct {
	Token string `json:"token"`
}
