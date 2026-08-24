package service

import (
	"api/model"
	"api/repository"
	"time"
)

// GoogleUserInfo — profil user dari Google (userinfo endpoint).
type GoogleUserInfo struct {
	Email string
	Name  string
	// EmailVerified: Google mengonfirmasi kepemilikan email (`verified_email`).
	EmailVerified bool
}

// OAuthService — penyambungan akun dari provider OAuth (E-AUTH-2026 R12).
type OAuthService interface {
	// LoginOrCreateUser: cari user by email → link akun existing (isi verified
	// bila Google mengonfirmasi), atau buat akun baru bila belum terdaftar
	// (password kosong — tidak bisa login password, verified sesuai info).
	LoginOrCreateUser(info GoogleUserInfo) (*model.User, error)
}

type oauthService struct {
	userRepo repository.UserRepository
}

func NewOAuthService(userRepo repository.UserRepository) OAuthService {
	return &oauthService{userRepo: userRepo}
}

func (s *oauthService) LoginOrCreateUser(info GoogleUserInfo) (*model.User, error) {
	user, err := s.userRepo.FindByEmail(info.Email)
	if err == nil {
		// Link akun existing. Email Google terverifikasi = bukti kepemilikan —
		// tandai verified bila belum (keputusan desain Q3: akun existing tidak
		// diblokir; verifikasi ini justru memperkuat).
		if info.EmailVerified && user.EmailVerifiedAt == nil {
			now := time.Now()
			user.EmailVerifiedAt = &now
			if err := s.userRepo.Save(user); err != nil {
				return nil, err
			}
		}
		return user, nil
	}

	// Akun baru dari Google: tanpa password (login password tidak mungkin),
	// role default user, verified bila Google mengonfirmasi email.
	user = &model.User{
		Name:  info.Name,
		Email: info.Email,
		Role:  string(model.RoleUser),
	}
	if info.EmailVerified {
		now := time.Now()
		user.EmailVerifiedAt = &now
	}
	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}
	return user, nil
}
