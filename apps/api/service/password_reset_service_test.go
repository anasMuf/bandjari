package service

import (
	"api/model"
	"api/utility"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var resetCodeRe = regexp.MustCompile(`code=([a-f0-9]{64})`)

func newPasswordResetTest(t *testing.T) (*fakeTokenUserRepo, *fakeMailer, *fakeRefreshRepo, PasswordResetService) {
	t.Helper()
	users := &fakeTokenUserRepo{users: map[uint]*model.User{
		1: {
			BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
			Name:      "Anas",
			Email:     "a@mail.com",
		},
	}}
	mailer := &fakeMailer{}
	refresh := newFakeRefreshRepo()
	return users, mailer, refresh, NewPasswordResetService(users, refresh, mailer)
}

// setupResetToken memasang kode reset valid pada user id 1, mengembalikan raw-nya.
func setupResetToken(users *fakeTokenUserRepo) string {
	raw, hash, _ := utility.GenerateVerificationCode()
	exp := time.Now().Add(ResetTokenTTL)
	users.users[1].ResetTokenHash = hash
	users.users[1].ResetExpiresAt = &exp
	return raw
}

// addActiveRefreshTokens membuat 2 refresh token aktif untuk user tertentu.
func addActiveRefreshTokens(ref *fakeRefreshRepo, userID uint) {
	exp := time.Now().Add(time.Hour)
	for i := 1; i <= 2; i++ {
		_, hash, _ := utility.GenerateRefreshToken()
		ref.tokens[hash] = &model.RefreshToken{
			BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: uint(i)}},
			UserID:    userID,
			TokenHash: hash,
			ExpiresAt: exp,
		}
	}
}

func TestRequestPasswordReset_SendsEmailAndStoresHash(t *testing.T) {
	users, mailer, _, svc := newPasswordResetTest(t)

	if err := svc.RequestPasswordReset("a@mail.com"); err != nil {
		t.Fatalf("RequestPasswordReset() error = %v", err)
	}
	if len(mailer.sent) != 1 {
		t.Fatalf("email terkirim = %d, want 1", len(mailer.sent))
	}
	match := resetCodeRe.FindStringSubmatch(mailer.sent[0].htmlBody)
	if match == nil {
		t.Fatalf("html harus memuat link reset dengan kode: %q", mailer.sent[0].htmlBody)
	}
	if !strings.Contains(mailer.sent[0].htmlBody, "Atur Password Baru") || !strings.Contains(mailer.sent[0].textBody, "/reset-password?code=") {
		t.Fatal("html harus memuat CTA reset; plain text harus memuat link")
	}
	user := users.users[1]
	if user.ResetTokenHash != utility.HashToken(match[1]) {
		t.Fatal("hash reset harus tersimpan (bukan plaintext)")
	}
	if user.ResetExpiresAt == nil || time.Until(*user.ResetExpiresAt) <= 0 {
		t.Fatal("reset_expires_at harus di masa depan")
	}
}

func TestRequestPasswordReset_UnknownEmailNoEmail(t *testing.T) {
	_, mailer, _, svc := newPasswordResetTest(t)

	if err := svc.RequestPasswordReset("tidak-ada@mail.com"); err != nil {
		t.Fatalf("error = %v, want nil (anti-enumeration)", err)
	}
	if len(mailer.sent) != 0 {
		t.Fatal("email tidak boleh terkirim untuk alamat yang tidak dikenal")
	}
}

func TestResetPassword_ValidToken(t *testing.T) {
	users, _, refresh, svc := newPasswordResetTest(t)
	raw := setupResetToken(users)
	addActiveRefreshTokens(refresh, 1)
	users.users[1].FailedLoginAttempts = 3
	past := time.Now().Add(-time.Hour)
	users.users[1].LockedUntil = &past
	oldHash := users.users[1].PasswordHash

	if _, err := svc.ResetPassword(raw, "password-baru-123"); err != nil {
		t.Fatalf("ResetPassword() error = %v", err)
	}

	user := users.users[1]
	// Password berubah & valid bcrypt.
	if user.PasswordHash == oldHash {
		t.Fatal("password hash harus berubah")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("password-baru-123")); err != nil {
		t.Fatalf("hash baru tidak cocok dengan password baru: %v", err)
	}
	// Token reset dibersihkan.
	if user.ResetTokenHash != "" || user.ResetExpiresAt != nil {
		t.Fatal("token reset harus dibersihkan setelah sukses")
	}
	// Lockout & password_changed_at.
	if user.FailedLoginAttempts != 0 || user.LockedUntil != nil {
		t.Fatal("lockout counter harus di-reset setelah reset password")
	}
	if user.PasswordChangedAt == nil {
		t.Fatal("password_changed_at harus terisi")
	}
	// SEMUA refresh token user dicabut.
	for _, tok := range refresh.tokens {
		if tok.UserID == 1 && tok.RevokedAt == nil {
			t.Fatal("semua session user harus dicabut setelah reset password")
		}
	}
}

func TestResetPassword_WrongCode(t *testing.T) {
	users, _, refresh, svc := newPasswordResetTest(t)
	setupResetToken(users)
	addActiveRefreshTokens(refresh, 1)

	if _, err := svc.ResetPassword("kode-salah", "password-baru-123"); !errors.Is(err, ErrInvalidResetToken) {
		t.Fatalf("err = %v, want ErrInvalidResetToken", err)
	}
	// Tidak ada efek samping: token tetap ada, sesi tetap hidup.
	if users.users[1].ResetTokenHash == "" {
		t.Fatal("token reset tidak boleh dibersihkan saat kode salah")
	}
	for _, tok := range refresh.tokens {
		if tok.RevokedAt != nil {
			t.Fatal("sesi tidak boleh dicabut saat kode salah")
		}
	}
}

func TestResetPassword_ExpiredToken(t *testing.T) {
	users, _, _, svc := newPasswordResetTest(t)
	_, hash, _ := utility.GenerateVerificationCode()
	exp := time.Now().Add(-time.Minute)
	users.users[1].ResetTokenHash = hash
	users.users[1].ResetExpiresAt = &exp

	if _, err := svc.ResetPassword("kode-apapun", "password-baru-123"); !errors.Is(err, ErrInvalidResetToken) {
		t.Fatalf("err = %v, want ErrInvalidResetToken (expired)", err)
	}
}

func TestResetPassword_UnknownCode(t *testing.T) {
	_, _, _, svc := newPasswordResetTest(t)
	if _, err := svc.ResetPassword("kode-tak-dikenal", "password-baru-123"); !errors.Is(err, ErrInvalidResetToken) {
		t.Fatalf("err = %v, want ErrInvalidResetToken", err)
	}
}

func TestResetPassword_WeakPassword(t *testing.T) {
	users, _, refresh, svc := newPasswordResetTest(t)
	raw := setupResetToken(users)
	addActiveRefreshTokens(refresh, 1)

	if _, err := svc.ResetPassword(raw, "123"); !errors.Is(err, ErrWeakPassword) {
		t.Fatalf("err = %v, want ErrWeakPassword", err)
	}
	// Tanpa efek samping: token tidak dibersihkan, sesi tidak dicabut.
	if users.users[1].ResetTokenHash == "" {
		t.Fatal("token reset tidak boleh dibersihkan saat password ditolak")
	}
	for _, tok := range refresh.tokens {
		if tok.RevokedAt != nil {
			t.Fatal("sesi tidak boleh dicabut saat password ditolak")
		}
	}
}
