package middleware

import (
	"github.com/labstack/echo/v4"
)

// OptionalAuth melanjutkan request sebagai Guest (context user kosong) bila token
// tidak ada/tidak valid — TIDAK menolak request. Dipakai untuk endpoint dengan akses
// Guest terbatas (mis. GET /songs/templates) — lihat TDD Bagian 6.8 / AD-8.
//
// CATATAN (FR-ROLE): context `role` di sini berasal dari KLAIM token — TIDAK
// disinkronkan ke database seperti JWTAuth. Jangan pernah memakai role dari
// context pada endpoint OptionalAuth untuk otorisasi admin; bila suatu endpoint
// GET butuh otorisasi admin, pindahkan ke JWTAuth (wajib login).
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
