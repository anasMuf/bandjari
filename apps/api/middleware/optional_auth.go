package middleware

import (
	"github.com/labstack/echo/v4"
)

// OptionalAuth melanjutkan request sebagai Guest (context user kosong) bila token
// tidak ada/tidak valid — TIDAK menolak request. Dipakai untuk endpoint dengan akses
// Guest terbatas (mis. GET /songs/templates) — lihat TDD Bagian 6.8 / AD-8.
func OptionalAuth(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		tokenString, ok := extractToken(c)
		if ok {
			if claims, err := parseToken(tokenString); err == nil {
				setUserContext(c, claims)
			}
		}
		return next(c)
	}
}
