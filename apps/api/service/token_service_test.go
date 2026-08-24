package service

import (
	"api/model"
	"api/utility"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt"
	"gorm.io/gorm"
)

// fakeTokenUserRepo — implementasi repository.UserRepository untuk test
// TokenService (FindByID dipakai resolve email saat refresh).
type fakeTokenUserRepo struct {
	users map[uint]*model.User
}

func (f *fakeTokenUserRepo) FindByEmail(email string) (*model.User, error) {
	for _, u := range f.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeTokenUserRepo) FindByID(id uint) (*model.User, error) {
	if u, ok := f.users[id]; ok {
		return u, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeTokenUserRepo) Create(u *model.User) error {
	u.ID = uint(len(f.users) + 1)
	f.users[u.ID] = u
	return nil
}

func (f *fakeTokenUserRepo) Save(u *model.User) error {
	f.users[u.ID] = u
	return nil
}

func (f *fakeTokenUserRepo) FindByVerificationTokenHash(hash string) (*model.User, error) {
	for _, u := range f.users {
		if u.VerificationTokenHash == hash {
			return u, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeTokenUserRepo) FindByResetTokenHash(hash string) (*model.User, error) {
	for _, u := range f.users {
		if u.ResetTokenHash == hash {
			return u, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

// fakeRefreshRepo — implementasi repository.RefreshTokenRepository di memory.
type fakeRefreshRepo struct {
	tokens map[string]*model.RefreshToken // key: token_hash
	nextID uint
}

func newFakeRefreshRepo() *fakeRefreshRepo {
	return &fakeRefreshRepo{tokens: map[string]*model.RefreshToken{}, nextID: 1}
}

func (f *fakeRefreshRepo) Create(t *model.RefreshToken) error {
	if _, ok := f.tokens[t.TokenHash]; ok {
		return errors.New("duplicate")
	}
	t.ID = f.nextID
	f.nextID++
	f.tokens[t.TokenHash] = t
	return nil
}

func (f *fakeRefreshRepo) FindByTokenHash(hash string) (*model.RefreshToken, error) {
	if t, ok := f.tokens[hash]; ok {
		return t, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeRefreshRepo) Rotate(old *model.RefreshToken, replacement *model.RefreshToken) error {
	now := time.Now()
	if err := f.Create(replacement); err != nil {
		return err
	}
	old.RevokedAt = &now
	id := replacement.ID
	old.ReplacedByID = &id
	return nil
}

func (f *fakeRefreshRepo) Revoke(token *model.RefreshToken) error {
	if token.RevokedAt == nil {
		now := time.Now()
		token.RevokedAt = &now
	}
	return nil
}

func (f *fakeRefreshRepo) RevokeAllByUserID(userID uint) error {
	now := time.Now()
	for _, t := range f.tokens {
		if t.UserID == userID && t.RevokedAt == nil {
			t.RevokedAt = &now
		}
	}
	return nil
}

func parseAccessTokenTest(t *testing.T, s string) jwt.MapClaims {
	t.Helper()
	token, err := jwt.Parse(s, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("signing method bukan HMAC")
		}
		return []byte("test-secret"), nil
	})
	if err != nil || !token.Valid {
		t.Fatalf("parse access token gagal: %v", err)
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("claims bukan MapClaims")
	}
	return claims
}

func newTokenServiceTest(t *testing.T) (*fakeTokenUserRepo, *fakeRefreshRepo, TokenService) {
	t.Helper()
	t.Setenv("JWT_SECRET", "test-secret")
	users := &fakeTokenUserRepo{users: map[uint]*model.User{
		1: {
			BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
			Name:      "Anas",
			Email:     "a@mail.com",
		},
	}}
	ref := newFakeRefreshRepo()
	return users, ref, NewTokenService(users, ref)
}

func TestTokenService_IssueSession(t *testing.T) {
	_, ref, svc := newTokenServiceTest(t)

	access, raw, err := svc.IssueSession(1, "a@mail.com", "Mozilla", "1.2.3.4")
	if err != nil {
		t.Fatalf("IssueSession() error = %v", err)
	}
	if len(raw) != 64 {
		t.Fatalf("raw panjang = %d, want 64", len(raw))
	}
	claims := parseAccessTokenTest(t, access)
	if claims["sub"] != "1" || claims["email"] != "a@mail.com" {
		t.Fatalf("claims tidak sesuai: %v", claims)
	}
	// Hash tersimpan, plaintext TIDAK.
	if _, ok := ref.tokens[raw]; ok {
		t.Fatal("plaintext refresh token tidak boleh tersimpan di repo")
	}
	if _, ok := ref.tokens[utility.HashToken(raw)]; !ok {
		t.Fatal("hash refresh token harus tersimpan")
	}
}

func TestTokenService_Refresh_Rotates(t *testing.T) {
	_, ref, svc := newTokenServiceTest(t)
	_, raw1, err := svc.IssueSession(1, "a@mail.com", "ua", "1.2.3.4")
	if err != nil {
		t.Fatalf("IssueSession() error = %v", err)
	}

	access2, raw2, err := svc.Refresh(raw1, "ua", "1.2.3.4")
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}
	if raw2 == raw1 {
		t.Fatal("refresh token harus dirotasi — raw tidak boleh sama")
	}
	if access2 == "" {
		t.Fatal("access token baru tidak boleh kosong")
	}
	old := ref.tokens[utility.HashToken(raw1)]
	if old.RevokedAt == nil {
		t.Fatal("token lama harus direvoke saat rotasi")
	}
	if old.ReplacedByID == nil {
		t.Fatal("token lama harus mencatat penggantinya (replaced_by_id)")
	}
	if _, ok := ref.tokens[utility.HashToken(raw2)]; !ok {
		t.Fatal("token baru harus tersimpan")
	}
}

func TestTokenService_Refresh_ReuseDetected(t *testing.T) {
	_, ref, svc := newTokenServiceTest(t)
	_, raw1, err := svc.IssueSession(1, "a@mail.com", "ua", "1.2.3.4")
	if err != nil {
		t.Fatalf("IssueSession() error = %v", err)
	}
	// Rotasi pertama: raw1 → raw2.
	if _, _, err := svc.Refresh(raw1, "ua", "1.2.3.4"); err != nil {
		t.Fatalf("Refresh() #1 error = %v", err)
	}
	// raw1 dipakai lagi (pencurian / klien nakal) → reuse detection.
	_, _, err = svc.Refresh(raw1, "ua", "1.2.3.4")
	if !errors.Is(err, ErrRefreshTokenReuse) {
		t.Fatalf("err = %v, want ErrRefreshTokenReuse", err)
	}
	// Semua session user harus dicabut.
	revoked := true
	for _, tok := range ref.tokens {
		if tok.UserID == 1 && tok.RevokedAt == nil {
			revoked = false
		}
	}
	if !revoked {
		t.Fatal("reuse detection harus merevoke SEMUA session user")
	}
}

func TestTokenService_Refresh_RevokedToken(t *testing.T) {
	_, _, svc := newTokenServiceTest(t)
	_, raw, err := svc.IssueSession(1, "a@mail.com", "ua", "1.2.3.4")
	if err != nil {
		t.Fatalf("IssueSession() error = %v", err)
	}
	if err := svc.Revoke(raw); err != nil {
		t.Fatalf("Revoke() error = %v", err)
	}
	_, _, err = svc.Refresh(raw, "ua", "1.2.3.4")
	if !errors.Is(err, ErrRefreshTokenRevoked) {
		t.Fatalf("err = %v, want ErrRefreshTokenRevoked", err)
	}
}

func TestTokenService_Refresh_Expired(t *testing.T) {
	_, ref, svc := newTokenServiceTest(t)
	now := time.Now()
	hash := utility.HashToken("raw-expired")
	ref.tokens[hash] = &model.RefreshToken{
		BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 5}},
		UserID:    1,
		TokenHash: hash,
		ExpiresAt: now.Add(-time.Hour),
	}

	_, _, err := svc.Refresh("raw-expired", "ua", "1.2.3.4")
	if !errors.Is(err, ErrRefreshTokenExpired) {
		t.Fatalf("err = %v, want ErrRefreshTokenExpired", err)
	}
}

func TestTokenService_Refresh_UnknownToken(t *testing.T) {
	_, _, svc := newTokenServiceTest(t)
	_, _, err := svc.Refresh("raw-tidak-dikenal", "ua", "1.2.3.4")
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("err = %v, want ErrInvalidRefreshToken", err)
	}
}

func TestTokenService_Revoke(t *testing.T) {
	_, ref, svc := newTokenServiceTest(t)
	_, raw, err := svc.IssueSession(1, "a@mail.com", "ua", "1.2.3.4")
	if err != nil {
		t.Fatalf("IssueSession() error = %v", err)
	}
	if err := svc.Revoke(raw); err != nil {
		t.Fatalf("Revoke() error = %v", err)
	}
	if ref.tokens[utility.HashToken(raw)].RevokedAt == nil {
		t.Fatal("token harus tercabut setelah Revoke")
	}
	// Revoke idempotent — memanggil ulang tidak error.
	if err := svc.Revoke(raw); err != nil {
		t.Fatalf("Revoke() kedua error = %v", err)
	}
}
