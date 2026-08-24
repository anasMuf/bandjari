package dto

type UserResponse struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	// Role: "admin" | "user" — admin boleh mengelola data System Template.
	Role string `json:"role"`
	// EmailVerified — status verifikasi email (untuk banner UI, E-AUTH-2026 R9).
	EmailVerified bool `json:"email_verified"`
}

type CreateUserRequest struct {
	Name  string `json:"name" validate:"required,min=1,max=255"`
	Email string `json:"email" validate:"required,email,max=255"`
	// Password: min 8 karakter (NIST SP 800-63B), maks 72 (batas bcrypt) — E-AUTH-2026 R11.
	Password string `json:"password" validate:"required,min=8,max=72"`
}

type LoginUserRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginUserResponse struct {
	Token string `json:"token"`
	// Role dipakai frontend untuk menampilkan kontrol admin tanpa menunggu /users.
	Role string `json:"role"`
}

// RefreshTokenResponse — hasil POST /auth/refresh: access token baru.
// Refresh token baru dikirim via httpOnly cookie (bukan body).
type RefreshTokenResponse struct {
	Token string `json:"token"`
}

// VerifyEmailRequest — hanya kode (tanpa email di body/URL); user dicari via
// hash token (E-AUTH-2026 R9).
type VerifyEmailRequest struct {
	Code string `json:"code" validate:"required"`
}

type ResendVerificationRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ResetPasswordRequest struct {
	Code     string `json:"code" validate:"required"`
	Password string `json:"password" validate:"required,min=8,max=72"`
}

type CheckEmailRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// CheckEmailResponse — metode login untuk email (email-first login):
// "password" | "google" | "none".
type CheckEmailResponse struct {
	Method string `json:"method"`
}
