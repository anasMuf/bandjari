package handler

import (
	"api/dto"
	"api/service"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt"
	"github.com/labstack/echo/v4"
)

type UserHandler struct {
	userService service.UserService
}

func NewUserHandler(userService service.UserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

// GetUser godoc
// @Summary      Get user profile
// @Description  Get current logged in user profile based on JWT token
// @Tags         users
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
// @Description  Create a new user with the provided details
// @Tags         users
// @Accept       json
// @Produce      json
// @Param        request  body      dto.CreateUserRequest  true  "User registration details"
// @Success      201      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Router       /users/register [post]
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
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusCreated, dto.SuccessResponse{
		Message: "User created successfully",
		Data:    user,
	})
}

// LoginUser godoc
// @Summary      Login user
// @Description  Authenticate user and return JWT token
// @Tags         users
// @Accept       json
// @Produce      json
// @Param        request  body      dto.LoginUserRequest  true  "User login credentials"
// @Success      200      {object}  dto.LoginUserResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Router       /users/login [post]
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
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid email or password")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"exp":     time.Now().Add(time.Hour * 24).Unix(), // token berlaku selama 24 jam
	})
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate token")
	}

	return c.JSON(http.StatusOK, dto.LoginUserResponse{
		Token: tokenString,
	})
}
