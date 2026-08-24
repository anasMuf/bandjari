package config

import "os"

// GoogleConfig — kredensial OAuth Google (E-AUTH-2026 R12).
type GoogleConfig struct {
	ClientID     string
	ClientSecret string
	// RedirectURL harus PERSIS sama dengan yang didaftarkan di Google Cloud
	// Console (prod: https://api.bandjari.net/api/v1/auth/google/callback).
	RedirectURL string
}

// LoadGoogleConfig membaca env GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
// Bila kosong → (config kosong, false): fitur Google OAuth nonaktif, API tetap
// jalan (bukan crash).
func LoadGoogleConfig() (GoogleConfig, bool) {
	id := os.Getenv("GOOGLE_CLIENT_ID")
	secret := os.Getenv("GOOGLE_CLIENT_SECRET")
	if id == "" || secret == "" {
		return GoogleConfig{}, false
	}
	redirect := os.Getenv("GOOGLE_REDIRECT_URL")
	if redirect == "" {
		redirect = "http://localhost:8080/api/v1/auth/google/callback"
	}
	return GoogleConfig{
		ClientID:     id,
		ClientSecret: secret,
		RedirectURL:  redirect,
	}, true
}
