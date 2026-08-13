package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt"
	"github.com/labstack/echo/v4"
)

func makeToken(t *testing.T, userID uint, email string) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": float64(userID),
		"email":   email,
		"exp":     time.Now().Add(time.Hour).Unix(),
	})
	s, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("gagal sign token: %v", err)
	}
	return s
}

func runMiddleware(t *testing.T, mw func(echo.HandlerFunc) echo.HandlerFunc, token string) (bool, echo.Context) {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	called := false
	handler := func(c echo.Context) error {
		called = true
		return nil
	}
	if err := mw(handler)(c); err != nil {
		return false, c
	}
	return called, c
}

func TestJWTAuth_RejectsMissingToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	called, _ := runMiddleware(t, JWTAuth, "")
	if called {
		t.Fatal("handler seharusnya tidak dipanggil tanpa token")
	}
}

func TestJWTAuth_AcceptsValidToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	token := makeToken(t, 42, "user@mail.com")
	called, c := runMiddleware(t, JWTAuth, token)
	if !called {
		t.Fatal("handler seharusnya dipanggil dengan token valid")
	}
	if got := c.Get("user_id"); got != uint(42) {
		t.Fatalf("user_id = %v, want 42", got)
	}
}

func TestOptionalAuth_AllowsGuest(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	called, c := runMiddleware(t, OptionalAuth, "")
	if !called {
		t.Fatal("handler harus tetap dipanggil tanpa token (Guest)")
	}
	if c.Get("user_id") != nil {
		t.Fatalf("user_id seharusnya kosong untuk Guest, got %v", c.Get("user_id"))
	}
}

func TestOptionalAuth_SetsUserOnValidToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	token := makeToken(t, 7, "guest@mail.com")
	called, c := runMiddleware(t, OptionalAuth, token)
	if !called {
		t.Fatal("handler harus dipanggil")
	}
	if got := c.Get("user_id"); got != uint(7) {
		t.Fatalf("user_id = %v, want 7", got)
	}
}

func TestOptionalAuth_IgnoresInvalidToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	called, c := runMiddleware(t, OptionalAuth, "bukan-token-valid")
	if !called {
		t.Fatal("handler harus tetap dipanggil walau token invalid")
	}
	if c.Get("user_id") != nil {
		t.Fatalf("user_id seharusnya kosong untuk token invalid, got %v", c.Get("user_id"))
	}
}
