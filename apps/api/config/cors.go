package config

import "strings"

// LoadCORSAllowedOrigins mengembalikan daftar origin yang diizinkan memanggil API.
// Nilai diambil dari env CORS_ALLOWED_ORIGINS (dipisah koma); default mencakup
// dev lokal (Vite :5173) dan produksi (bandjari.net).
func LoadCORSAllowedOrigins() []string {
	raw := envDefault("CORS_ALLOWED_ORIGINS",
		"http://localhost:5173,http://127.0.0.1:5173,https://bandjari.net,https://www.bandjari.net")
	origins := []string{}
	for _, o := range strings.Split(raw, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}
