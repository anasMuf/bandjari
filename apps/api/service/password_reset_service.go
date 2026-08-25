package service

import (
	"api/model"
	"api/repository"
	"api/utility"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// ResetTokenTTL — umur kode reset password (E-AUTH-2026 R10): 1 jam.
const ResetTokenTTL = time.Hour

// ResetCooldown — interval minimum antar pengiriman email reset ke alamat yang
// sama (anti email-bombing via forgot-password — review E-AUTH-2026).
const ResetCooldown = 60 * time.Second

// PasswordResetService — alur lupa password (E-AUTH-2026 R10).
type PasswordResetService interface {
	// RequestPasswordReset membuat kode reset & mengirim email. Email tidak
	// dikenal → nil (anti-enumeration, tanpa email terkirim).
	RequestPasswordReset(email string) error
	// ResetPassword mengganti password bila kode valid. Kode cukup (tanpa
	// email — cari user by hash token). Semua kegagalan (kode tidak
	// dikenal/kedaluwarsa) → ErrInvalidResetToken. Sukses → hash baru,
	// PasswordChangedAt, bersihkan token, reset lockout counter, REVOKE semua
	// refresh token (semua sesi mati), dan mengembalikan user (untuk audit).
	ResetPassword(code, newPassword string) (*model.User, error)
}

type passwordResetService struct {
	userRepo    repository.UserRepository
	refreshRepo repository.RefreshTokenRepository
	mailer      Mailer
}

func NewPasswordResetService(
	userRepo repository.UserRepository,
	refreshRepo repository.RefreshTokenRepository,
	mailer Mailer,
) PasswordResetService {
	return &passwordResetService{
		userRepo:    userRepo,
		refreshRepo: refreshRepo,
		mailer:      mailer,
	}
}

func resetBody(name, code string) string {
	_, text := resetEmail(name, code)
	return text
}

func (s *passwordResetService) RequestPasswordReset(email string) error {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return nil // anti-enumeration — tanpa email terkirim
	}
	// Cooldown anti-spam: no-op bila kirim ulang terlalu cepat ke alamat yang
	// sama (respons tetap seragam — anti-enumeration terjaga).
	if user.ResetSentAt != nil && time.Since(*user.ResetSentAt) < ResetCooldown {
		return nil
	}

	raw, hash, err := utility.GenerateVerificationCode()
	if err != nil {
		return err
	}
	exp := time.Now().Add(ResetTokenTTL)
	now := time.Now()
	user.ResetSentAt = &now
	user.ResetTokenHash = hash
	user.ResetExpiresAt = &exp
	if err := s.userRepo.Save(user); err != nil {
		return err
	}
	html, text := resetEmail(user.Name, raw)
	return s.mailer.Send(user.Email, "Reset password BandJari", html, text)
}

func (s *passwordResetService) ResetPassword(code, newPassword string) (*model.User, error) {
	if code == "" {
		return nil, ErrInvalidResetToken
	}
	// Policy password (NIST, E-AUTH-2026 R11) — defense in depth sama seperti
	// CreateUser; harus divalidasi SEBELUM menyentuh state user.
	if len(newPassword) < 8 || len(newPassword) > 72 {
		return nil, ErrWeakPassword
	}

	user, err := s.userRepo.FindByResetTokenHash(utility.HashToken(code))
	if err != nil {
		return nil, ErrInvalidResetToken // seragam — kode tidak dikenal
	}
	if user.ResetExpiresAt == nil {
		return nil, ErrInvalidResetToken
	}
	if time.Now().After(*user.ResetExpiresAt) {
		return nil, ErrInvalidResetToken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	user.PasswordHash = string(hash)
	user.PasswordChangedAt = &now
	user.ResetTokenHash = ""
	user.ResetExpiresAt = nil
	// Reset lockout — user yang terkunci bisa membuka akun via reset.
	user.FailedLoginAttempts = 0
	user.LockedUntil = nil
	if err := s.userRepo.Save(user); err != nil {
		return nil, err
	}
	// Semua sesi mati: password baru + sesi lama tidak boleh hidup.
	if err := s.refreshRepo.RevokeAllByUserID(user.ID); err != nil {
		return nil, err
	}
	return user, nil
}
