package service

import (
	"api/model"
	"api/utility"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"
)

type sentEmail struct {
	to, subject, htmlBody, textBody string
}

type fakeMailer struct {
	sent []sentEmail
}

func (f *fakeMailer) Send(to, subject, html, text string) error {
	f.sent = append(f.sent, sentEmail{to: to, subject: subject, htmlBody: html, textBody: text})
	return nil
}

var codeRe = regexp.MustCompile(`code=([a-f0-9]{64})`)

func newVerificationTest(t *testing.T) (*fakeTokenUserRepo, *fakeMailer, VerificationService) {
	t.Helper()
	users := &fakeTokenUserRepo{users: map[uint]*model.User{
		1: {
			BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
			Name:      "Anas",
			Email:     "a@mail.com",
		},
	}}
	mailer := &fakeMailer{}
	return users, mailer, NewVerificationService(users, mailer)
}

func TestRequestEmailVerification_SendsEmailAndStoresHash(t *testing.T) {
	users, mailer, svc := newVerificationTest(t)

	if err := svc.RequestEmailVerification("a@mail.com"); err != nil {
		t.Fatalf("RequestEmailVerification() error = %v", err)
	}
	if len(mailer.sent) != 1 {
		t.Fatalf("email terkirim = %d, want 1", len(mailer.sent))
	}
	if mailer.sent[0].to != "a@mail.com" {
		t.Fatalf("to = %q", mailer.sent[0].to)
	}
	match := codeRe.FindStringSubmatch(mailer.sent[0].htmlBody)
	if match == nil {
		t.Fatalf("html harus memuat link verifikasi dengan kode: %q", mailer.sent[0].htmlBody)
	}
	// Body HTML punya tombol CTA; plain text berisi link polos (fallback).
	if !strings.Contains(mailer.sent[0].htmlBody, `href="`) || !strings.Contains(mailer.sent[0].htmlBody, "Verifikasi Email") {
		t.Fatal("html harus memuat tombol CTA verifikasi")
	}
	if !strings.Contains(mailer.sent[0].textBody, "/verify?code=") {
		t.Fatal("plain text harus memuat link verifikasi")
	}
	raw := match[1]
	user := users.users[1]
	if user.VerificationTokenHash != utility.HashToken(raw) {
		t.Fatal("hash verifikasi harus tersimpan (bukan plaintext)")
	}
	if user.VerificationExpiresAt == nil || time.Until(*user.VerificationExpiresAt) <= 0 {
		t.Fatal("verification_expires_at harus di masa depan")
	}
}

func TestRequestEmailVerification_UnknownEmailNoEmail(t *testing.T) {
	_, mailer, svc := newVerificationTest(t)

	if err := svc.RequestEmailVerification("tidak-ada@mail.com"); err != nil {
		t.Fatalf("error = %v, want nil (anti-enumeration)", err)
	}
	if len(mailer.sent) != 0 {
		t.Fatal("email tidak boleh terkirim untuk alamat yang tidak dikenal")
	}
}

func TestRequestEmailVerification_AlreadyVerifiedNoResend(t *testing.T) {
	users, mailer, svc := newVerificationTest(t)
	now := time.Now()
	users.users[1].EmailVerifiedAt = &now

	if err := svc.RequestEmailVerification("a@mail.com"); err != nil {
		t.Fatalf("error = %v", err)
	}
	if len(mailer.sent) != 0 {
		t.Fatal("tidak boleh kirim ulang untuk akun yang sudah terverifikasi")
	}
}

func TestRequestEmailVerification_CooldownNoResend(t *testing.T) {
	users, mailer, svc := newVerificationTest(t)

	if err := svc.RequestEmailVerification("a@mail.com"); err != nil {
		t.Fatalf("kirim pertama error = %v", err)
	}
	if len(mailer.sent) != 1 {
		t.Fatalf("email terkirim = %d, want 1", len(mailer.sent))
	}
	if users.users[1].VerificationSentAt == nil {
		t.Fatal("verification_sent_at harus tercatat")
	}

	// Kirim lagi dalam cooldown (60 detik) → no-op, tanpa email kedua.
	if err := svc.RequestEmailVerification("a@mail.com"); err != nil {
		t.Fatalf("kirim kedua error = %v (harus no-op)", err)
	}
	if len(mailer.sent) != 1 {
		t.Fatalf("cooldown harus mencegah kirim ulang: email = %d, want 1", len(mailer.sent))
	}
}

func TestRequestEmailVerification_CooldownExpiredAllowsResend(t *testing.T) {
	users, mailer, svc := newVerificationTest(t)
	past := time.Now().Add(-3 * time.Minute)
	users.users[1].VerificationSentAt = &past

	if err := svc.RequestEmailVerification("a@mail.com"); err != nil {
		t.Fatalf("error = %v", err)
	}
	if len(mailer.sent) != 1 {
		t.Fatalf("cooldown sudah lewat → boleh kirim: email = %d, want 1", len(mailer.sent))
	}
}

func TestVerifyEmail_ValidCode(t *testing.T) {
	users, _, svc := newVerificationTest(t)
	raw, hash, err := utility.GenerateVerificationCode()
	if err != nil {
		t.Fatalf("GenerateVerificationCode() error = %v", err)
	}
	exp := time.Now().Add(VerificationTTL)
	users.users[1].VerificationTokenHash = hash
	users.users[1].VerificationExpiresAt = &exp

	if _, err := svc.VerifyEmail(raw); err != nil {
		t.Fatalf("VerifyEmail() error = %v", err)
	}
	user := users.users[1]
	if user.EmailVerifiedAt == nil {
		t.Fatal("email_verified_at harus terisi")
	}
	if user.VerificationTokenHash != "" || user.VerificationExpiresAt != nil {
		t.Fatal("token verifikasi harus dibersihkan setelah sukses")
	}

	// Kode sekali pakai: setelah sukses, hash dibersihkan — kode yang sama
	// tidak bisa dipakai lagi (wajar).
	if _, err := svc.VerifyEmail(raw); !errors.Is(err, ErrInvalidVerificationCode) {
		t.Fatalf("kode bekas harus ditolak, got err = %v", err)
	}
}

func TestVerifyEmail_WrongCode(t *testing.T) {
	users, _, svc := newVerificationTest(t)
	raw, hash, err := utility.GenerateVerificationCode()
	if err != nil {
		t.Fatalf("GenerateVerificationCode() error = %v", err)
	}
	exp := time.Now().Add(VerificationTTL)
	users.users[1].VerificationTokenHash = hash
	users.users[1].VerificationExpiresAt = &exp
	_ = raw

	if _, err := svc.VerifyEmail("kode-salah"); !errors.Is(err, ErrInvalidVerificationCode) {
		t.Fatalf("err = %v, want ErrInvalidVerificationCode", err)
	}
}

func TestVerifyEmail_Expired(t *testing.T) {
	users, _, svc := newVerificationTest(t)
	_, hash, err := utility.GenerateVerificationCode()
	if err != nil {
		t.Fatalf("GenerateVerificationCode() error = %v", err)
	}
	exp := time.Now().Add(-time.Minute)
	users.users[1].VerificationTokenHash = hash
	users.users[1].VerificationExpiresAt = &exp

	if _, err := svc.VerifyEmail("kode-apapun"); !errors.Is(err, ErrInvalidVerificationCode) {
		t.Fatalf("err = %v, want ErrInvalidVerificationCode (expired)", err)
	}
}

func TestVerifyEmail_UnknownCodeOrNoToken(t *testing.T) {
	users, _, svc := newVerificationTest(t)

	// Kode tidak dikenal → error seragam.
	if _, err := svc.VerifyEmail("kode-tak-dikenal"); !errors.Is(err, ErrInvalidVerificationCode) {
		t.Fatalf("err = %v, want ErrInvalidVerificationCode (kode tak dikenal)", err)
	}
	// User ada tapi belum pernah minta verifikasi → error seragam.
	if _, err := svc.VerifyEmail("kode-lain"); !errors.Is(err, ErrInvalidVerificationCode) {
		t.Fatalf("err = %v, want ErrInvalidVerificationCode (tanpa token)", err)
	}
	_ = users
}
