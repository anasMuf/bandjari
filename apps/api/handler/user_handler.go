package handler

import (
	"api/dto"
	"api/middleware"
	"api/service"
	"api/utility"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
)

type UserHandler struct {
	userService          service.UserService
	tokenService         service.TokenService
	verificationService  service.VerificationService
	passwordResetService service.PasswordResetService
	auditService         service.AuditService
}

func NewUserHandler(
	userService service.UserService,
	tokenService service.TokenService,
	verificationService service.VerificationService,
	passwordResetService service.PasswordResetService,
	auditService service.AuditService,
) *UserHandler {
	return &UserHandler{
		userService:          userService,
		tokenService:         tokenService,
		verificationService:  verificationService,
		passwordResetService: passwordResetService,
		auditService:         auditService,
	}
}

// recordAudit — pencatatan jejak keamanan best-effort (E-AUTH-2026 R13):
// kegagalan audit TIDAK menggagalkan operasi utama.
func (h *UserHandler) recordAudit(c echo.Context, action string, userID *uint, detail map[string]any) {
	_ = h.auditService.Record(userID, action, detail, c.RealIP(), c.Request().UserAgent())
}

// GetUser godoc
// @Summary      Get user profile
// @Description  Get current logged in user profile based on JWT token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Success      200  {object}  dto.SuccessResponse
// @Failure      401  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Router       /users [get]
func (h *UserHandler) GetUser(c echo.Context) error {
	email := c.Get("email").(string) // mendapat email dari klaim JWT yang sudah di-parse di middleware JWTAuth
	user, err := h.userService.GetUserByEmail(email)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "User retrieved successfully",
		Data:    user,
	})
}

// CreateUser godoc
// @Summary      Register new user
// @Description  Create a new user account (name, email, password)
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request  body      dto.CreateUserRequest  true  "User registration details"
// @Success      201      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      409      {object}  dto.ErrorResponse
// @Router       /auth/register [post]
func (h *UserHandler) CreateUser(c echo.Context) error {
	var req dto.CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}
	user, err := h.userService.CreateUser(req)
	if err != nil {
		if errors.Is(err, service.ErrEmailTaken) {
			return echo.NewHTTPError(http.StatusConflict, "Email sudah terdaftar — silakan masuk, atau gunakan \"Masuk dengan Google\" bila akun dibuat dengan Google")
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Kirim email verifikasi — best-effort: kegagalan pengiriman TIDAK
	// menggagalkan registrasi (E-AUTH-2026 R9).
	if verifErr := h.verificationService.RequestEmailVerification(req.Email); verifErr != nil {
		middleware.MakeLogEntry(c).Warn("gagal kirim email verifikasi: " + verifErr.Error())
	}
	uid := user.ID
	h.recordAudit(c, service.ActionRegister, &uid, map[string]any{"email": req.Email})

	return c.JSON(http.StatusCreated, dto.SuccessResponse{
		Message: "Akun berhasil dibuat — cek email untuk verifikasi",
		Data:    user,
	})
}

// VerifyEmail godoc
// @Summary      Verify email
// @Description  Validasi kode verifikasi email dan menandai email terverifikasi
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request  body      dto.VerifyEmailRequest  true  "Email + kode verifikasi"
// @Success      200      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Router       /auth/verify-email [post]
func (h *UserHandler) VerifyEmail(c echo.Context) error {
	var req dto.VerifyEmailRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}

	user, err := h.verificationService.VerifyEmail(req.Code)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, service.ErrInvalidVerificationCode.Error())
	}
	h.recordAudit(c, service.ActionVerifyEmail, &user.ID, map[string]any{"email": user.Email})
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Email berhasil diverifikasi"})
}

// ResendVerification godoc
// @Summary      Resend verification email
// @Description  Kirim ulang link verifikasi. Respons selalu 200 (anti email-enumeration)
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request  body      dto.ResendVerificationRequest  true  "Email"
// @Success      200      {object}  dto.SuccessResponse
// @Router       /auth/resend-verification [post]
func (h *UserHandler) ResendVerification(c echo.Context) error {
	var req dto.ResendVerificationRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}

	// Anti-enumeration: respons sama untuk email terdaftar maupun tidak.
	_ = h.verificationService.RequestEmailVerification(req.Email)
	return c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "Bila email terdaftar, link verifikasi telah dikirim",
	})
}

// ForgotPassword godoc
// @Summary      Request password reset
// @Description  Kirim link reset password. Respons selalu 200 (anti email-enumeration)
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request  body      dto.ForgotPasswordRequest  true  "Email"
// @Success      200      {object}  dto.SuccessResponse
// @Router       /auth/forgot-password [post]
func (h *UserHandler) ForgotPassword(c echo.Context) error {
	var req dto.ForgotPasswordRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}

	// Anti-enumeration: respons selalu 200, apa pun status email.
	_ = h.passwordResetService.RequestPasswordReset(req.Email)
	h.recordAudit(c, service.ActionForgotPassword, nil, map[string]any{"email": req.Email})
	return c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "Bila email terdaftar, link reset password telah dikirim",
	})
}

// ResetPassword godoc
// @Summary      Reset password
// @Description  Ganti password memakai kode reset; semua sesi lama dicabut
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request  body      dto.ResetPasswordRequest  true  "Email + kode + password baru"
// @Success      200      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Router       /auth/reset-password [post]
func (h *UserHandler) ResetPassword(c echo.Context) error {
	var req dto.ResetPasswordRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}

	user, err := h.passwordResetService.ResetPassword(req.Code, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidResetToken) {
			return echo.NewHTTPError(http.StatusBadRequest, service.ErrInvalidResetToken.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	h.recordAudit(c, service.ActionResetPassword, &user.ID, map[string]any{"email": user.Email})
	return c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "Password berhasil diubah — silakan masuk dengan password baru",
	})
}

// CheckEmail godoc
// @Summary      Check login method for email
// @Description  Email-first login: kembalikan metode login (password/google/none)
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request  body      dto.CheckEmailRequest  true  "Email"
// @Success      200      {object}  dto.CheckEmailResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Router       /auth/check-email [post]
func (h *UserHandler) CheckEmail(c echo.Context) error {
	var req dto.CheckEmailRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}

	method, err := h.userService.CheckEmailMethod(req.Email)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Gagal memeriksa email")
	}
	return c.JSON(http.StatusOK, dto.CheckEmailResponse{Method: method})
}

// LoginUser godoc
// @Summary      Login user
// @Description  Authenticate user and return JWT token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request  body      dto.LoginUserRequest  true  "User login credentials"
// @Success      200      {object}  dto.LoginUserResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Router       /auth/login [post]
func (h *UserHandler) LoginUser(c echo.Context) error {
	var req dto.LoginUserRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}
	user, err := h.userService.LoginUser(req.Email, req.Password)
	if err != nil {
		// Audit internal (respons tetap seragam 401 — anti-enumeration).
		if errors.Is(err, service.ErrAccountLocked) {
			h.recordAudit(c, service.ActionLoginLocked, nil, map[string]any{"email": req.Email})
		} else {
			h.recordAudit(c, service.ActionLoginFailed, nil, map[string]any{"email": req.Email})
		}
		// Akun Google (tanpa password): kode eksplisit agar frontend bisa
		// menampilkan tombol "Masuk dengan Google" langsung (bukan hanya pesan).
		if errors.Is(err, service.ErrSocialLoginRequired) {
			return echo.NewHTTPError(http.StatusUnauthorized, map[string]interface{}{
				"message": "Akun ini menggunakan Google — silakan masuk dengan Google",
				"code":    "SOCIAL_LOGIN_REQUIRED",
			})
		}
		return echo.NewHTTPError(http.StatusUnauthorized, "Email atau password salah")
	}
	h.recordAudit(c, service.ActionLoginSuccess, &user.ID, map[string]any{"email": req.Email})

	// Access token pendek (15 menit) + refresh token di httpOnly cookie
	// (E-AUTH-2026 R1/R2/R3).
	access, raw, err := h.tokenService.IssueSession(user.ID, user.Email, c.Request().UserAgent(), c.RealIP())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Gagal membuat sesi")
	}
	setRefreshCookie(c, raw)

	return c.JSON(http.StatusOK, dto.LoginUserResponse{
		Token: access,
		Role:  user.Role,
	})
}

// RefreshSession godoc
// @Summary      Refresh access token
// @Description  Memutar refresh token (httpOnly cookie) dan mengembalikan access token baru
// @Tags         auth
// @Accept       json
// @Produce      json
// @Success      200  {object}  dto.RefreshTokenResponse
// @Failure      401  {object}  dto.ErrorResponse
// @Router       /auth/refresh [post]
func (h *UserHandler) RefreshSession(c echo.Context) error {
	cookie, err := c.Cookie(utility.RefreshTokenCookieName)
	if err != nil || cookie.Value == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "Refresh token tidak ditemukan")
	}

	access, raw, err := h.tokenService.Refresh(cookie.Value, c.Request().UserAgent(), c.RealIP())
	if err != nil {
		clearRefreshCookie(c)
		if errors.Is(err, service.ErrRefreshTokenReuse) {
			// Seluruh session user sudah dicabut (pencurian) — frontend harus
			// logout penuh, bukan sekadar coba refresh lagi.
			return echo.NewHTTPError(http.StatusUnauthorized, "Sesi telah dicabut — silakan login ulang")
		}
		return echo.NewHTTPError(http.StatusUnauthorized, "Sesi kedaluwarsa — silakan login ulang")
	}

	setRefreshCookie(c, raw)
	h.recordAudit(c, service.ActionRefresh, nil, nil)
	return c.JSON(http.StatusOK, dto.RefreshTokenResponse{Token: access})
}

// Logout godoc
// @Summary      Logout
// @Description  Mencabut refresh token server-side dan menghapus cookie (idempotent)
// @Tags         auth
// @Success      204
// @Router       /auth/logout [post]
func (h *UserHandler) Logout(c echo.Context) error {
	if cookie, err := c.Cookie(utility.RefreshTokenCookieName); err == nil && cookie.Value != "" {
		_ = h.tokenService.Revoke(cookie.Value)
	}
	clearRefreshCookie(c)
	h.recordAudit(c, service.ActionLogout, nil, nil)
	return c.NoContent(http.StatusNoContent)
}

// setRefreshCookie memasang refresh token sebagai cookie httpOnly yang hanya
// dikirim ke route /api/v1/auth (E-AUTH-2026 R3). Secure selalu aktif — browser
// modern memperlakukan localhost sebagai secure context sehingga dev tetap jalan.
func setRefreshCookie(c echo.Context, raw string) {
	c.SetCookie(&http.Cookie{
		Name:     utility.RefreshTokenCookieName,
		Value:    raw,
		Path:     utility.RefreshTokenCookiePath,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(utility.RefreshTokenTTL.Seconds()),
	})
}

// clearRefreshCookie menghapus cookie refresh token (Max-Age=-1).
func clearRefreshCookie(c echo.Context) {
	c.SetCookie(&http.Cookie{
		Name:     utility.RefreshTokenCookieName,
		Value:    "",
		Path:     utility.RefreshTokenCookiePath,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}
