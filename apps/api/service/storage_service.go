package service

import (
	"api/config"
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// StorageService mengabstraksi penyimpanan file audio di object storage
// S3-compatible (MinIO dev / Cloudflare R2 prod) — lihat TDD Bagian 6.6.
type StorageService interface {
	Upload(ctx context.Context, key string, data io.Reader, size int64, contentType string) error
	GenerateSignedURL(ctx context.Context, key string, ttl time.Duration) (string, error)
	Delete(ctx context.Context, key string) error
}

type storageService struct {
	client *s3.Client
	bucket string
}

func NewStorageService(cfg config.StorageConfig) (StorageService, error) {
	if cfg.Endpoint == "" || cfg.Bucket == "" {
		return nil, fmt.Errorf("konfigurasi storage tidak lengkap: STORAGE_ENDPOINT & STORAGE_BUCKET wajib diisi")
	}

	client := s3.New(s3.Options{
		Region:       cfg.Region,
		BaseEndpoint: aws.String(cfg.Endpoint),
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		UsePathStyle: cfg.UsePathStyle,
	})

	return &storageService{client: client, bucket: cfg.Bucket}, nil
}

// Upload menyimpan file ke object storage pada key tertentu.
func (s *storageService) Upload(ctx context.Context, key string, data io.Reader, size int64, contentType string) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          data,
		ContentLength: aws.Int64(size),
		ContentType:   aws.String(contentType),
	})
	return err
}

// GenerateSignedURL menghasilkan signed URL sementara (default 60 menit) untuk
// akses baca file tanpa kredensial — dipakai client saat playback/preview.
func (s *storageService) GenerateSignedURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	presign := s3.NewPresignClient(s.client)
	req, err := presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = ttl
	})
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

// Delete menghapus object dari storage. Object yang sudah tidak ada dianggap sukses.
func (s *storageService) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}
