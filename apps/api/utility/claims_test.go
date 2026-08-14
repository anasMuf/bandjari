package utility

import (
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestGetCurrentUserID(t *testing.T) {
	tests := []struct {
		name     string
		set      interface{}
		setValue bool
		want     *uint
	}{
		{"guest - not set", nil, false, nil},
		{"valid user id", uint(7), true, ptr(7)},
		{"wrong type", float64(7), true, nil},
		{"zero id", uint(0), true, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest("GET", "/", nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			if tt.setValue {
				c.Set("user_id", tt.set)
			}
			got := GetCurrentUserID(c)
			if (got == nil) != (tt.want == nil) {
				t.Fatalf("GetCurrentUserID() = %v, want %v", got, tt.want)
			}
			if got != nil && *got != *tt.want {
				t.Fatalf("GetCurrentUserID() = %d, want %d", *got, *tt.want)
			}
		})
	}
}

func ptr(u uint) *uint {
	return &u
}

func TestGetCurrentUserRole(t *testing.T) {
	tests := []struct {
		name     string
		set      interface{}
		setValue bool
		want     string
	}{
		{"belum diset → default user", nil, false, "user"},
		{"role kosong → default user", "", true, "user"},
		{"role admin", "admin", true, "admin"},
		{"role tak dikenal → dikembalikan apa adanya", "superman", true, "superman"},
		{"tipe salah → default user", 123, true, "user"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest("GET", "/", nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			if tt.setValue {
				c.Set("role", tt.set)
			}
			if got := GetCurrentUserRole(c); got != tt.want {
				t.Fatalf("GetCurrentUserRole() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestIsAdmin(t *testing.T) {
	tests := []struct {
		name     string
		set      interface{}
		setValue bool
		want     bool
	}{
		{"guest → bukan admin", nil, false, false},
		{"user → bukan admin", "user", true, false},
		{"admin → admin", "admin", true, true},
		{"nilai tak dikenal → bukan admin", "superman", true, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest("GET", "/", nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			if tt.setValue {
				c.Set("role", tt.set)
			}
			if got := IsAdmin(c); got != tt.want {
				t.Fatalf("IsAdmin() = %v, want %v", got, tt.want)
			}
		})
	}
}
