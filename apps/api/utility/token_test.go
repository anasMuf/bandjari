package utility

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt"
)

const testSecret = "test-secret"

// mustSign membuat token JWT HS256 untuk keperluan test.
func mustSign(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return s
}

// parseTest memvalidasi & mengekstrak claims token (cermin parseToken middleware).
func parseTest(t *testing.T, tokenString string) jwt.MapClaims {
	t.Helper()
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("signing method bukan HMAC")
		}
		return []byte(testSecret), nil
	})
	if err != nil || !token.Valid {
		t.Fatalf("parse token gagal: %v", err)
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("claims bukan MapClaims")
	}
	return claims
}

func TestGenerateAccessToken_ClaimsLengkap(t *testing.T) {
	t.Setenv("JWT_SECRET", testSecret)
	t.Setenv("JWT_ISSUER", "https://api.bandjari.net")

	s, err := GenerateAccessToken(42, "a@mail.com")
	if err != nil {
		t.Fatalf("GenerateAccessToken() error = %v", err)
	}
	claims := parseTest(t, s)

	if claims["sub"] != "42" {
		t.Fatalf("sub = %v, want 42", claims["sub"])
	}
	if claims["user_id"] != float64(42) {
		t.Fatalf("user_id = %v, want 42", claims["user_id"])
	}
	if claims["email"] != "a@mail.com" {
		t.Fatalf("email = %v, want a@mail.com", claims["email"])
	}
	if claims["iss"] != "https://api.bandjari.net" {
		t.Fatalf("iss = %v", claims["iss"])
	}
	if claims["aud"] != Audience {
		t.Fatalf("aud = %v, want %s", claims["aud"], Audience)
	}
	if claims["jti"] == nil || claims["jti"] == "" {
		t.Fatalf("jti harus terisi, got %v", claims["jti"])
	}

	exp := int64(claims["exp"].(float64))
	iat := int64(claims["iat"].(float64))
	if exp-iat != int64(AccessTokenTTL.Seconds()) {
		t.Fatalf("umur token = %ds, want %ds", exp-iat, int64(AccessTokenTTL.Seconds()))
	}
}

func TestGenerateAccessToken_TokenExpiredDitolak(t *testing.T) {
	t.Setenv("JWT_SECRET", testSecret)
	expired := mustSign(t, jwt.MapClaims{
		"sub":     "1",
		"user_id": float64(1),
		"email":   "a@mail.com",
		"iss":     "https://api.bandjari.net",
		"aud":     Audience,
		"iat":     time.Now().Add(-2 * time.Hour).Unix(),
		"exp":     time.Now().Add(-1 * time.Hour).Unix(),
		"jti":     "abc-123",
	})
	if _, err := jwt.Parse(expired, func(t *jwt.Token) (interface{}, error) {
		return []byte(testSecret), nil
	}); err == nil {
		t.Fatal("token dengan exp di masa lalu harus ditolak")
	}
}

func TestGenerateRefreshToken_RawDanHash(t *testing.T) {
	raw, hash, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken() error = %v", err)
	}
	if len(raw) != 64 {
		t.Fatalf("raw panjang = %d, want 64 (32 byte hex)", len(raw))
	}
	if len(hash) != 64 {
		t.Fatalf("hash panjang = %d, want 64 (SHA-256 hex)", len(hash))
	}
	if raw == hash {
		t.Fatal("raw dan hash tidak boleh identik")
	}
	if HashToken(raw) != hash {
		t.Fatal("hash harus SHA-256 dari raw")
	}
	raw2, _, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken() #2 error = %v", err)
	}
	if raw == raw2 {
		t.Fatal("raw harus acak — dua panggilan tidak boleh sama")
	}
}
