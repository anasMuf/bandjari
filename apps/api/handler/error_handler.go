// handler/error_handler.go
package handler

import (
	"api/dto"
	"api/middleware"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

// Helper: Mapping pesan default ke kode error
func parseErrorCode(message string, status int) string {
	msg := strings.ToLower(message)
	switch status {
	case http.StatusNotFound:
		return "NOT_FOUND"
	case http.StatusUnauthorized:
		return "UNAUTHORIZED"
	case http.StatusForbidden:
		return "FORBIDDEN"
	case http.StatusBadRequest:
		if strings.Contains(msg, "validation") || strings.Contains(msg, "invalid") {
			return "VALIDATION_ERROR"
		}
		return "BAD_REQUEST"
	case http.StatusConflict:
		return "CONFLICT"
	default:
		return "INTERNAL_ERROR"
	}
}

// Custom global error handler
func CustomHTTPErrorHandler(err error, c echo.Context) {
	code := http.StatusInternalServerError
	msg := "Internal Server Error"
	var details interface{}

	// Default dari Echo adalah *echo.HTTPError
	if he, ok := err.(*echo.HTTPError); ok {
		code = he.Code
		switch m := he.Message.(type) {
		case string:
			msg = m
		case map[string]interface{}:
			msg = m["message"].(string)
			details = m["details"]
		default:
			msg = he.Message.(string)
		}
	} else {
		msg = err.Error()
	}

	// Tambahan: Log error dengan Logrus!
	middleware.MakeLogEntry(c).Error(msg)

	// Generate standardized code (bisa diimprove ke const/error map)
	errCode := parseErrorCode(msg, code)

	// Buat response error contract
	res := dto.ErrorResponse{
		Status:  code,
		Code:    errCode,
		Message: msg,
		Details: details,
	}

	// Pastikan response dalam format JSON
	if !c.Response().Committed {
		c.JSON(code, res)
	}
}
