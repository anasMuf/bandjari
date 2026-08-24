package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

// TestCustomHTTPErrorHandler_ExplicitCode — kode error eksplisit dari map
// message (mis. SOCIAL_LOGIN_REQUIRED) harus dipertahankan, bukan di-override
// parseErrorCode berdasarkan status.
func TestCustomHTTPErrorHandler_ExplicitCode(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	CustomHTTPErrorHandler(echo.NewHTTPError(http.StatusUnauthorized, map[string]interface{}{
		"message": "Akun ini menggunakan Google — silakan masuk dengan Google",
		"code":    "SOCIAL_LOGIN_REQUIRED",
	}), c)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("respons bukan JSON valid: %v", err)
	}
	if body["code"] != "SOCIAL_LOGIN_REQUIRED" {
		t.Fatalf("code = %v, want SOCIAL_LOGIN_REQUIRED", body["code"])
	}
	if body["message"] != "Akun ini menggunakan Google — silakan masuk dengan Google" {
		t.Fatalf("message = %v", body["message"])
	}
}

// TestCustomHTTPErrorHandler_StatusCode — tanpa kode eksplisit, parseErrorCode
// tetap bekerja seperti sebelumnya.
func TestCustomHTTPErrorHandler_StatusCode(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	CustomHTTPErrorHandler(echo.NewHTTPError(http.StatusNotFound, "User tidak ditemukan"), c)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("respons bukan JSON valid: %v", err)
	}
	if body["code"] != "NOT_FOUND" {
		t.Fatalf("code = %v, want NOT_FOUND", body["code"])
	}
}
