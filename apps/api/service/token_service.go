package service

import (
	"api/model"
	"api/repository"
	"api/utility"
	"errors"
	"time"

	"gorm.io/gorm"
)

// TokenService — siklus hidup refresh token & penerbitan access token
// (E-AUTH-2026 R1/R2/R6/R9).
type TokenService interface {
	// IssueSession menerbitkan pasangan access + refresh token untuk session baru.
	// email dipakai untuk claims access token (pemanggil biasanya sudah memegang
	// objek user hasil login — tidak perlu query ulang).
	IssueSession(userID uint, email, userAgent, ip string) (accessToken, rawRefresh string, err error)
	// Refresh memutar refresh token: validasi → rotasi (lama direvoke) → access
	// token baru. Bila token yang sudah dirotasi dipakai lagi (reuse detection),
	// seluruh session user dicabut dan ErrRefreshTokenReuse dikembalikan.
	Refresh(raw, userAgent, ip string) (accessToken, newRaw string, err error)
	// Revoke mencabut satu refresh token (logout). Idempotent bila token tidak
	// ditemukan atau sudah dicabut.
	Revoke(raw string) error
}

type tokenService struct {
	userRepo    repository.UserRepository
	refreshRepo repository.RefreshTokenRepository
}

func NewTokenService(userRepo repository.UserRepository, refreshRepo repository.RefreshTokenRepository) TokenService {
	return &tokenService{
		userRepo:    userRepo,
		refreshRepo: refreshRepo,
	}
}

func (s *tokenService) IssueSession(userID uint, email, userAgent, ip string) (string, string, error) {
	access, err := utility.GenerateAccessToken(userID, email)
	if err != nil {
		return "", "", err
	}
	raw, hash, err := utility.GenerateRefreshToken()
	if err != nil {
		return "", "", err
	}
	token := &model.RefreshToken{
		UserID:    userID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(utility.RefreshTokenTTL),
		UserAgent: userAgent,
		IP:        ip,
	}
	if err := s.refreshRepo.Create(token); err != nil {
		return "", "", err
	}
	return access, raw, nil
}

func (s *tokenService) Refresh(raw, userAgent, ip string) (string, string, error) {
	if raw == "" {
		return "", "", ErrInvalidRefreshToken
	}
	hash := utility.HashToken(raw)
	token, err := s.refreshRepo.FindByTokenHash(hash)
	if err != nil {
		return "", "", ErrInvalidRefreshToken
	}

	// Reuse detection: token yang SUDAH dirotasi (punya ReplacedByID) tapi
	// masih dipakai lagi menandakan pencurian — cabut seluruh session user.
	if token.RevokedAt != nil && token.ReplacedByID != nil {
		if revokeErr := s.refreshRepo.RevokeAllByUserID(token.UserID); revokeErr != nil {
			return "", "", revokeErr
		}
		return "", "", ErrRefreshTokenReuse
	}
	if token.RevokedAt != nil {
		return "", "", ErrRefreshTokenRevoked
	}
	if time.Now().After(token.ExpiresAt) {
		return "", "", ErrRefreshTokenExpired
	}

	user, err := s.userRepo.FindByID(token.UserID)
	if err != nil {
		return "", "", ErrInvalidRefreshToken
	}

	access, err := utility.GenerateAccessToken(user.ID, user.Email)
	if err != nil {
		return "", "", err
	}

	// Rotasi: simpan pengganti + revoke yang lama (atomik di repository).
	newRaw, newHash, err := utility.GenerateRefreshToken()
	if err != nil {
		return "", "", err
	}
	replacement := &model.RefreshToken{
		UserID:    token.UserID,
		TokenHash: newHash,
		ExpiresAt: time.Now().Add(utility.RefreshTokenTTL),
		UserAgent: userAgent,
		IP:        ip,
	}
	if err := s.refreshRepo.Rotate(token, replacement); err != nil {
		return "", "", err
	}
	return access, newRaw, nil
}

func (s *tokenService) Revoke(raw string) error {
	if raw == "" {
		return nil
	}
	hash := utility.HashToken(raw)
	token, err := s.refreshRepo.FindByTokenHash(hash)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil // idempotent — tidak ada yang dicabut
		}
		return err
	}
	return s.refreshRepo.Revoke(token)
}
