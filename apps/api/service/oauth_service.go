package service

import (
	"api/model"
	"api/repository"
	"errors"
	"time"
)

// GoogleUserInfo — profil user dari Google (userinfo endpoint).
type GoogleUserInfo struct {
	Email string
	Name  string
	// EmailVerified: Google mengonfirmasi kepemilikan email (`verified_email`).
	EmailVerified bool
	// ProviderSubject — sub stable dari Google (userinfo "id"). Basis match
	// login V1-A: (provider, provider_subject), bukan email murni.
	ProviderSubject string
}

// OAuthService — penyambungan akun dari provider OAuth (E-AUTH-2026 R12,
// diperluas E-PROFILE-2026 V1-A).
type OAuthService interface {
	// LoginOrCreateUser — alur login Google (V1-A):
	// 1. Match by (provider, provider_subject) → pakai akun terhubung.
	// 2. Email cocok + akun TANPA password (legacy Google-only) → auto-link +
	//    backfill row provider.
	// 3. Email cocok + akun BER-password → ErrSocialLinkRequired (user harus
	//    link eksplisit dari pengaturan — tidak ada auto-link ulang setelah
	//    unlink).
	// 4. Email tidak terdaftar → buat akun baru (Google-only) + provider row.
	LoginOrCreateUser(info GoogleUserInfo) (*model.User, error)
	// LinkProvider menghubungkan provider ke user yang sudah login. Idempotent:
	// link yang sama tidak dibuat dua kali. Bila subject sudah terhubung ke akun
	// LAIN, ErrProviderTaken dikembalikan.
	LinkProvider(userID uint, provider, subject string) error
	// UnlinkProvider memutuskan provider dari user. Ditolak (ErrLastLoginMethod)
	// bila ini satu-satunya metode login user (tanpa password & tanpa provider
	// lain) — akun tidak boleh terkunci selamanya.
	UnlinkProvider(userID uint, provider string) error
}

type oauthService struct {
	userRepo     repository.UserRepository
	providerRepo repository.UserProviderRepository
}

func NewOAuthService(userRepo repository.UserRepository, providerRepo repository.UserProviderRepository) OAuthService {
	return &oauthService{userRepo: userRepo, providerRepo: providerRepo}
}

// linkProvider menyimpan link provider (idempotent per (user, provider)).
func (s *oauthService) linkProvider(userID uint, provider, subject string) error {
	if subject == "" {
		return errors.New("provider subject kosong")
	}
	// Idempotent: sudah terhubung → tidak perlu apa-apa.
	existing, err := s.providerRepo.FindByUserIDAndProvider(userID, provider)
	if err == nil && existing != nil && existing.ID != 0 {
		return nil
	}
	// Subject milik akun lain → tolak (unique index juga menjaga di DB).
	if other, err := s.providerRepo.FindByProviderSubject(provider, subject); err == nil && other != nil && other.ID != 0 && other.UserID != userID {
		return ErrProviderTaken
	}
	link := &model.UserProvider{
		UserID:          userID,
		Provider:        provider,
		ProviderSubject: subject,
	}
	return s.providerRepo.Create(link)
}

func (s *oauthService) LoginOrCreateUser(info GoogleUserInfo) (*model.User, error) {
	// 1. Match by (provider, provider_subject) — basis utama V1-A.
	if info.ProviderSubject != "" {
		link, err := s.providerRepo.FindByProviderSubject(string(model.ProviderGoogle), info.ProviderSubject)
		if err == nil && link != nil && link.ID != 0 {
			user, err := s.userRepo.FindByID(link.UserID)
			if err != nil {
				return nil, err
			}
			// Google confirm → pastikan verified (akun yang sama, info segar).
			if info.EmailVerified && user.EmailVerifiedAt == nil {
				now := time.Now()
				user.EmailVerifiedAt = &now
				if err := s.userRepo.Save(user); err != nil {
					return nil, err
				}
			}
			return user, nil
		}
	}

	// 2. Email fallback — HANYA untuk akun tanpa password (legacy Google-only).
	user, err := s.userRepo.FindByEmail(info.Email)
	if err == nil {
		if user.PasswordHash != "" {
			// Akun ber-password: tolak login Google (V1-A) — arahkan ke link
			// eksplisit dari pengaturan.
			return nil, ErrSocialLinkRequired
		}
		// Backfill: akun Google-only legacy → simpan provider link.
		if info.ProviderSubject != "" {
			if err := s.linkProvider(user.ID, string(model.ProviderGoogle), info.ProviderSubject); err != nil {
				return nil, err
			}
		}
		if info.EmailVerified && user.EmailVerifiedAt == nil {
			now := time.Now()
			user.EmailVerifiedAt = &now
			if err := s.userRepo.Save(user); err != nil {
				return nil, err
			}
		}
		return user, nil
	}

	// 3. Akun baru dari Google: tanpa password (login password tidak mungkin),
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
	if info.ProviderSubject != "" {
		if err := s.linkProvider(user.ID, string(model.ProviderGoogle), info.ProviderSubject); err != nil {
			return nil, err
		}
	}
	return user, nil
}

func (s *oauthService) LinkProvider(userID uint, provider, subject string) error {
	if provider == "" {
		return errors.New("provider kosong")
	}
	// User harus ada — mencegah row provider menggantung ke akun yang tidak
	// ada (mis. user sudah dihapus). Konsisten dengan UnlinkProvider.
	if _, err := s.userRepo.FindByID(userID); err != nil {
		return ErrUserNotFound
	}
	return s.linkProvider(userID, provider, subject)
}

func (s *oauthService) UnlinkProvider(userID uint, provider string) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	// Guard: jangan cabut satu-satunya metode login (akun terkunci selamanya).
	hasPassword := user.PasswordHash != ""
	otherProviders := 0
	if links, err := s.providerRepo.ListByUserID(userID); err == nil {
		for _, l := range links {
			if l.Provider != provider {
				otherProviders++
			}
		}
	}
	if !hasPassword && otherProviders == 0 {
		return ErrLastLoginMethod
	}
	return s.providerRepo.Delete(userID, provider)
}
