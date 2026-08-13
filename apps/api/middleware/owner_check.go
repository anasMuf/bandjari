package middleware

import (
	"api/utility"
	"net/http"

	"github.com/labstack/echo/v4"
)

// EnsureOwner memvalidasi kepemilikan resource (FR-AUTH-02).
// ownerID == nil berarti resource milik System (template) — bukan milik user manapun.
// Mengembalikan 403 bila user saat ini bukan pemilik resource.
func EnsureOwner(c echo.Context, ownerID *uint) error {
	current := utility.GetCurrentUserID(c)
	if current == nil {
		return echo.NewHTTPError(http.StatusForbidden, "Login required")
	}
	if ownerID == nil || *ownerID != *current {
		return echo.NewHTTPError(http.StatusForbidden, "You do not own this resource")
	}
	return nil
}
