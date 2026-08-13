package config

import (
	"os"
	"strconv"
)

// StorageConfig menampung konfigurasi object storage S3-compatible
// (MinIO untuk dev, Cloudflare R2 untuk produksi — lihat TDD AD-4).
type StorageConfig struct {
	Endpoint        string // URL endpoint S3-compatible (mis. http://localhost:9000)
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	UsePathStyle    bool // true untuk MinIO, false untuk R2
}

func LoadStorageConfig() StorageConfig {
	usePathStyle, _ := strconv.ParseBool(os.Getenv("STORAGE_USE_PATH_STYLE"))
	return StorageConfig{
		Endpoint:        os.Getenv("STORAGE_ENDPOINT"),
		Region:          envDefault("STORAGE_REGION", "us-east-1"),
		Bucket:          os.Getenv("STORAGE_BUCKET"),
		AccessKeyID:     os.Getenv("STORAGE_ACCESS_KEY_ID"),
		SecretAccessKey: os.Getenv("STORAGE_SECRET_ACCESS_KEY"),
		UsePathStyle:    usePathStyle,
	}
}

func envDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
