package config

import (
	"os"
	"strings"
)

// LoadCORSAllowedOrigins mengembalikan daftar origin yang diizinkan memanggil API.
// Nilai diambil dari env CORS_ALLOWED_ORIGINS (dipisah koma).
//
// Bila env kosong (dev lokal), semua origin diizinkan — perilaku default Echo —
// agar pengembangan di port/host mana pun (mis. vite --port 3000) tidak terhambat.
// Produksi wajib menyetel daftar eksplisit (lihat docker-compose.prod.yml).
func LoadCORSAllowedOrigins() []string {
	raw := os.Getenv("CORS_ALLOWED_ORIGINS")
	if raw == "" {
		return []string{"*"}
	}
	origins := []string{}
	for _, o := range strings.Split(raw, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}
