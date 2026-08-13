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
