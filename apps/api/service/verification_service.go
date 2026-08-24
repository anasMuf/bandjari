package service

import (
	"api/model"
	"api/repository"
	"api/utility"
	"time"
)

// VerificationTTL — umur kode verifikasi email (E-AUTH-2026 R9): 24 jam.
const VerificationTTL = 24 * time.Hour

// VerificationCooldown — interval minimum antar pengiriman email verifikasi ke
// alamat yang sama (anti email-bombing & jaga reputasi sender).
const VerificationCooldown = 60 * time.Second

// VerificationService — alur verifikasi email (E-AUTH-2026 R9).
type VerificationService interface {
	// RequestEmailVerification membuat kode verifikasi baru & mengirim email.
	// Email tidak dikenal → nil (anti-enumeration: tanpa email terkirim, tanpa
	// sinyal). Akun sudah terverifikasi → nil (tidak kirim ulang).
	RequestEmailVerification(email string) error
	// VerifyEmail memvalidasi kode & menandai email terverifikasi. Kode cukup
	// (tanpa email — cari user by hash token). Semua kegagalan (kode tidak
	// dikenal/kedaluwarsa) → ErrInvalidVerificationCode. Kode sekali pakai:
	// setelah sukses hash dibersihkan. Mengembalikan user (untuk audit).
	VerifyEmail(code string) (*model.User, error)
}

type verificationService struct {
	userRepo repository.UserRepository
	mailer   Mailer
}

func NewVerificationService(userRepo repository.UserRepository, mailer Mailer) VerificationService {
	return &verificationService{
		userRepo: userRepo,
		mailer:   mailer,
	}
}

// appBaseURL — origin frontend untuk link di email. Default dev; produksi wajib
// menyetel APP_BASE_URL (mis. https://bandjari.net).
func appBaseURL() string {
	return utility.AppBaseURL()
}

// verificationEmail dipakai untuk membangun body — lihat email_templates.go.

func (s *verificationService) RequestEmailVerification(email string) error {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return nil // anti-enumeration — respons seragam, tanpa email terkirim
	}
	if user.EmailVerifiedAt != nil {
		return nil // sudah terverifikasi — tidak kirim ulang
	}
	// Cooldown anti-spam: jangan kirim ulang terlalu cepat ke alamat yang sama
	// (no-op tanpa error — respons tetap seragam, anti-enumeration terjaga).
	if user.VerificationSentAt != nil && time.Since(*user.VerificationSentAt) < VerificationCooldown {
		return nil
	}

	raw, hash, err := utility.GenerateVerificationCode()
	if err != nil {
		return err
	}
	exp := time.Now().Add(VerificationTTL)
	now := time.Now()
	user.VerificationSentAt = &now
	user.VerificationTokenHash = hash
	user.VerificationExpiresAt = &exp
	if err := s.userRepo.Save(user); err != nil {
		return err
	}
	html, text := verificationEmail(user.Name, raw)
	return s.mailer.Send(user.Email, "Verifikasi email BandJari", html, text)
}

func (s *verificationService) VerifyEmail(code string) (*model.User, error) {
	if code == "" {
		return nil, ErrInvalidVerificationCode
	}
	user, err := s.userRepo.FindByVerificationTokenHash(utility.HashToken(code))
	if err != nil {
		return nil, ErrInvalidVerificationCode // seragam — kode tidak dikenal
	}
	if user.EmailVerifiedAt != nil {
		return user, nil // idempotent
	}
	if user.VerificationExpiresAt == nil {
		return nil, ErrInvalidVerificationCode
	}
	if time.Now().After(*user.VerificationExpiresAt) {
		return nil, ErrInvalidVerificationCode
	}

	now := time.Now()
	user.EmailVerifiedAt = &now
	user.VerificationTokenHash = ""
	user.VerificationExpiresAt = nil
	if err := s.userRepo.Save(user); err != nil {
		return nil, err
	}
	return user, nil
}
