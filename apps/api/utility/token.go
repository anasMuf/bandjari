package utility

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt"
	"github.com/google/uuid"
)

const (
	// AccessTokenTTL — umur access token (E-AUTH-2026 R1): 15 menit.
	// Access token pendek agar dampak kebocoran terbatas; perpanjangan
	// dilakukan lewat refresh token.
	AccessTokenTTL = 15 * time.Minute
	// RefreshTokenTTL — umur refresh token (E-AUTH-2026 R2): 30 hari.
	RefreshTokenTTL = 30 * 24 * time.Hour
	// Audience — klaim aud access token. Pemanggil lain (aud berbeda) harus ditolak.
	Audience = "bandjari-platform"
	// RefreshTokenCookieName — nama cookie httpOnly untuk refresh token.
	RefreshTokenCookieName = "refresh_token"
	// RefreshTokenCookiePath — cookie hanya dikirim ke route auth.
	RefreshTokenCookiePath = "/api/v1/auth"
)

// TokenIssuer mengembalikan nilai klaim iss — dari env JWT_ISSUER, default
// origin API produksi.
func TokenIssuer() string {
	if v := os.Getenv("JWT_ISSUER"); v != "" {
		return v
	}
	return "https://api.bandjari.net"
}

// AppBaseURL — origin frontend untuk link di email & redirect OAuth. Default
// dev; produksi wajib menyetel APP_BASE_URL (mis. https://bandjari.net).
func AppBaseURL() string {
	if v := os.Getenv("APP_BASE_URL"); v != "" {
		return v
	}
	return "http://localhost:3000"
}

// GenerateAccessToken membuat access JWT HS256 berumur AccessTokenTTL dengan
// claims lengkap (E-AUTH-2026 R1/R8): sub, user_id, email, iss, aud, iat, exp,
// jti. user_id tetap disertakan (numeric) agar middleware & context existing
// tetap berfungsi; sub (string) mengikuti konvensi JWT.
func GenerateAccessToken(userID uint, email string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":     fmt.Sprintf("%d", userID),
		"user_id": userID,
		"email":   email,
		"iss":     TokenIssuer(),
		"aud":     Audience,
		"iat":     now.Unix(),
		"exp":     now.Add(AccessTokenTTL).Unix(),
		"jti":     uuid.NewString(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

// GenerateRefreshToken membuat refresh token acak 256-bit (crypto/rand).
// Mengembalikan raw (hex, satu-satunya yang dikirim ke client) dan hash
// SHA-256 (hex) — hanya hash yang disimpan di database (E-AUTH-2026
// anti-pattern: NO plaintext token di DB).
func GenerateRefreshToken() (raw string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(buf)
	return raw, HashToken(raw), nil
}

// GenerateVerificationCode — kode verifikasi email sekali pakai (E-AUTH-2026
// R9): 32 byte acak, raw dikirim ke email, hash SHA-256 yang disimpan di DB.
func GenerateVerificationCode() (raw string, hash string, err error) {
	return GenerateRefreshToken()
}

// HashToken = SHA-256 hex. Dipakai untuk refresh/verification/reset token —
// semua nilai rahasia disimpan sebagai hash, bukan plaintext.
func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
