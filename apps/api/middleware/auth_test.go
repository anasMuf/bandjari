package middleware

import (
	"api/model"
	"api/repository"
	"api/utility"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

// fakeUserRepo — implementasi repository.UserRepository untuk tes middleware.
type fakeUserRepo struct {
	users map[string]*model.User
}

func newFakeUserRepo() *fakeUserRepo {
	return &fakeUserRepo{users: map[string]*model.User{}}
}

func (f *fakeUserRepo) FindByEmail(email string) (*model.User, error) {
	if u, ok := f.users[email]; ok {
		return u, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeUserRepo) FindByID(id uint) (*model.User, error) {
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeUserRepo) Create(req *model.User) error {
	f.users[req.Email] = req
	return nil
}

func (f *fakeUserRepo) Save(user *model.User) error {
	f.users[user.Email] = user
	return nil
}

func (f *fakeUserRepo) FindByVerificationTokenHash(hash string) (*model.User, error) {
	for _, u := range f.users {
		if u.VerificationTokenHash == hash {
			return u, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeUserRepo) FindByResetTokenHash(hash string) (*model.User, error) {
	for _, u := range f.users {
		if u.ResetTokenHash == hash {
			return u, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeUserRepo) Delete(userID uint) error {
	return nil
}

var _ repository.UserRepository = (*fakeUserRepo)(nil)

func makeToken(t *testing.T, userID uint, email string) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": float64(userID),
		"email":   email,
		"role":    "user",
		"exp":     time.Now().Add(time.Hour).Unix(),
	})
	s, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("gagal sign token: %v", err)
	}
	return s
}

// makeTokenWithClaims membuat token JWT dengan claims arbitrer (untuk uji iss/aud).
func makeTokenWithClaims(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
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
	called, _ := runMiddleware(t, JWTAuth(newFakeUserRepo()), "")
	if called {
		t.Fatal("handler seharusnya tidak dipanggil tanpa token")
	}
}

func TestJWTAuth_AcceptsValidToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	repo := newFakeUserRepo()
	repo.users["user@mail.com"] = &model.User{Name: "U", Email: "user@mail.com", Role: "user"}
	repo.users["user@mail.com"].ID = 42
	token := makeToken(t, 42, "user@mail.com")
	called, c := runMiddleware(t, JWTAuth(repo), token)
	if !called {
		t.Fatal("handler seharusnya dipanggil dengan token valid")
	}
	if got := c.Get("user_id"); got != uint(42) {
		t.Fatalf("user_id = %v, want 42", got)
	}
	if got := c.Get("role"); got != "user" {
		t.Fatalf("role = %v, want user (dari DB)", got)
	}
}

// TestJWTAuth_RoleSyncedFromDB — role di context mengikuti DATABASE, bukan
// klaim token: demosi/promosi langsung berlaku tanpa menunggu token kedaluwarsa
// (FR-ROLE).
func TestJWTAuth_RoleSyncedFromDB(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	repo := newFakeUserRepo()
	repo.users["a@mail.com"] = &model.User{Name: "A", Email: "a@mail.com", Role: "user"}
	repo.users["a@mail.com"].ID = 1

	token := makeToken(t, 1, "a@mail.com")
	_, c := runMiddleware(t, JWTAuth(repo), token)
	if got := c.Get("role"); got != "user" {
		t.Fatalf("role = %v, want user (DB)", got)
	}

	// Promosi di DB → request berikutnya langsung admin, token TIDAK diubah.
	repo.users["a@mail.com"].Role = "admin"
	_, c2 := runMiddleware(t, JWTAuth(repo), token)
	if got := c2.Get("role"); got != "admin" {
		t.Fatalf("role = %v, want admin (DB) setelah promosi", got)
	}

	// Demosi kembali → token lama kehilangan kekuasaan admin seketika.
	repo.users["a@mail.com"].Role = "user"
	_, c3 := runMiddleware(t, JWTAuth(repo), token)
	if got := c3.Get("role"); got != "user" {
		t.Fatalf("role = %v, want user (DB) setelah demosi", got)
	}
}

func TestJWTAuth_UnknownUserGets401(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	called, _ := runMiddleware(t, JWTAuth(newFakeUserRepo()), makeToken(t, 9, "hilang@mail.com"))
	if called {
		t.Fatal("handler seharusnya tidak dipanggil bila user tidak ada di DB")
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

// E-AUTH-2026 R8: token dengan iss/aud yang salah harus ditolak.
func TestJWTAuth_RejectsWrongIssuerOrAudience(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	repo := newFakeUserRepo()
	repo.users["a@mail.com"] = &model.User{Name: "A", Email: "a@mail.com", Role: "user"}
	repo.users["a@mail.com"].ID = 1

	// iss salah.
	badIss := makeTokenWithClaims(t, jwt.MapClaims{
		"user_id": float64(1), "email": "a@mail.com", "role": "user",
		"exp": time.Now().Add(time.Hour).Unix(),
		"iss": "https://evil.example", "aud": utility.Audience, "jti": "x",
	})
	called, _ := runMiddleware(t, JWTAuth(repo), badIss)
	if called {
		t.Fatal("handler seharusnya TIDAK dipanggil untuk iss salah")
	}

	// aud salah.
	badAud := makeTokenWithClaims(t, jwt.MapClaims{
		"user_id": float64(1), "email": "a@mail.com", "role": "user",
		"exp": time.Now().Add(time.Hour).Unix(),
		"iss": utility.TokenIssuer(), "aud": "aplikasi-lain", "jti": "x",
	})
	called, _ = runMiddleware(t, JWTAuth(repo), badAud)
	if called {
		t.Fatal("handler seharusnya TIDAK dipanggil untuk aud salah")
	}
}

// Kompatibilitas: token lama (tanpa iss/aud/jti) tetap diterima sampai exp —
// TIDAK ada logout massal saat deploy (anti-pattern epic).
func TestJWTAuth_AcceptsTokenWithoutIssAud(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	repo := newFakeUserRepo()
	repo.users["a@mail.com"] = &model.User{Name: "A", Email: "a@mail.com", Role: "user"}
	repo.users["a@mail.com"].ID = 1

	legacy := makeToken(t, 1, "a@mail.com") // helper existing: tanpa iss/aud/jti
	called, c := runMiddleware(t, JWTAuth(repo), legacy)
	if !called {
		t.Fatal("token lama tanpa claims harus tetap diterima (kompatibilitas)")
	}
	if got := c.Get("user_id"); got != uint(1) {
		t.Fatalf("user_id = %v, want 1", got)
	}
}
