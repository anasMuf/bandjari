package model

// Provider adalah identifier provider OAuth (E-PROFILE-2026 R1).
type Provider string

const (
	// ProviderGoogle — Google OAuth (E-AUTH-2026 R12).
	ProviderGoogle Provider = "google"
)

// UserProvider merepresentasikan satu akun eksternal (mis. Google) yang
// terhubung ke akun BandJari. Tabel ini memungkinkan multi-provider & unlink
// bersih — match login via (provider, provider_subject), bukan email murni
// (E-PROFILE-2026 V1-A). ProviderSubject = sub stable dari provider
// (Google userinfo "id").
type UserProvider struct {
	BaseModel
	// Unique (user_id, provider): satu user satu link per provider.
	UserID uint `json:"user_id" gorm:"not null;uniqueIndex:idx_user_provider"`
	// Provider: "google" (enum siap diperluas — GitHub, Apple, dll).
	Provider string `json:"provider" gorm:"type:varchar(32);not null;uniqueIndex:idx_user_provider;uniqueIndex:idx_provider_subject"`
	// ProviderSubject — sub stable dari provider. Unique (provider,
	// provider_subject): satu akun eksternal hanya terhubung ke satu akun.
	ProviderSubject string `json:"provider_subject" gorm:"type:varchar(255);not null;uniqueIndex:idx_provider_subject"`
}

func (UserProvider) TableName() string {
	return "user_providers"
}
