package middleware

import (
	"api/model"
	"api/repository"
	"api/utility"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt"
	"github.com/labstack/echo/v4"
)

// parseToken memvalidasi token JWT dan mengembalikan claims-nya.
// Dipakai bersama oleh JWTAuth (wajib) dan OptionalAuth (opsional).
func parseToken(tokenString string) (jwt.MapClaims, error) {
	secret := os.Getenv("JWT_SECRET")
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, echo.NewHTTPError(http.StatusUnauthorized, "Invalid signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, echo.NewHTTPError(http.StatusUnauthorized, "Invalid token claims")
	}
	// E-AUTH-2026 R8: token baru wajib membawa iss/aud yang sesuai. Token lama
	// (tanpa claims ini) tetap diterima sampai exp — TIDAK ada logout massal
	// saat deploy (anti-pattern epic).
	if iss, ok := claims["iss"].(string); ok && iss != utility.TokenIssuer() {
		return nil, echo.NewHTTPError(http.StatusUnauthorized, "Token issuer tidak dikenal")
	}
	if aud, ok := claims["aud"].(string); ok && aud != utility.Audience {
		return nil, echo.NewHTTPError(http.StatusUnauthorized, "Token audience tidak sesuai")
	}
	return claims, nil
}

// extractToken mengambil string token dari header Authorization (Bearer).
func extractToken(c echo.Context) (string, bool) {
	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return "", false
	}
	return strings.TrimPrefix(authHeader, "Bearer "), true
}

// setUserContext menulis user_id, email & role dari claims ke context echo.
func setUserContext(c echo.Context, claims jwt.MapClaims) {
	if raw, ok := claims["user_id"].(float64); ok && raw > 0 { // numeric JSON decode jadi float64
		c.Set("user_id", uint(raw))
	}
	if email, ok := claims["email"].(string); ok {
		c.Set("email", email)
	}
	if role, ok := claims["role"].(string); ok {
		c.Set("role", role)
	}
}

// JWTAuth menolak request tanpa token valid (401). Role pengguna disinkronkan
// dari DATABASE (bukan klaim token) agar perubahan role langsung berlaku —
// token lama tidak menyimpan kekuasaan admin (FR-ROLE).
func JWTAuth(userRepo repository.UserRepository) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			tokenString, ok := extractToken(c)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "Missing or invalid Authorization header")
			}
			claims, err := parseToken(tokenString)
			if err != nil {
				return err
			}
			setUserContext(c, claims)

			email, _ := c.Get("email").(string)
			if email == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token claims")
			}
			user, err := userRepo.FindByEmail(email)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "User tidak ditemukan")
			}
			role := user.Role
			if role == "" {
				role = string(model.RoleUser) // baris lama tanpa role → user biasa
			}
			c.Set("role", role)
			c.Set("user_id", user.ID) // id dari DB — lebih tepercaya daripada klaim token

			return next(c)
		}
	}
}
