package utility

import (
	"github.com/labstack/echo/v4"
)

// GetCurrentUserID mengembalikan ID user dari context echo.
// Nil adalah Guest (belum login / token tidak valid pada endpoint optional auth).
func GetCurrentUserID(c echo.Context) *uint {
	raw, ok := c.Get("user_id").(uint)
	if !ok || raw == 0 {
		return nil
	}
	id := raw
	return &id
}

// GetCurrentUserRole mengembalikan role dari context echo — default "user"
// (token lama tanpa klaim role, atau klaim tidak valid).
func GetCurrentUserRole(c echo.Context) string {
	role, ok := c.Get("role").(string)
	if !ok || role == "" {
		return "user"
	}
	return role
}

// IsAdmin true bila user yang sedang login ber-role admin.
func IsAdmin(c echo.Context) bool {
	return GetCurrentUserRole(c) == "admin"
}
