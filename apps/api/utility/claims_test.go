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
