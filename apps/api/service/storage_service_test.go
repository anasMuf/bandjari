package service

import (
	"api/config"
	"bytes"
	"context"
	"io"
	"net/http"
	"os"
	"testing"
	"time"
)

// TestStorage_UploadAndSignedURL adalah integration test terhadap MinIO lokal.
// Dijalankan hanya bila STORAGE_TEST=1 (memerlukan `docker compose up -d minio`).
func TestStorage_UploadAndSignedURL(t *testing.T) {
	if os.Getenv("STORAGE_TEST") != "1" {
		t.Skip("STORAGE_TEST != 1 — jalankan dengan MinIO lokal (docker compose up -d minio)")
	}

	cfg := config.LoadStorageConfig()
	svc, err := NewStorageService(cfg)
	if err != nil {
		t.Fatalf("NewStorageService() error = %v", err)
	}

	ctx := context.Background()
	key := "samples/test/" + time.Now().Format("20060102-150405") + ".wav"
	content := []byte("RIFF-fake-wav-content")
	if err := svc.Upload(ctx, key, bytes.NewReader(content), int64(len(content)), "audio/wav"); err != nil {
		t.Fatalf("Upload() error = %v", err)
	}

	url, err := svc.GenerateSignedURL(ctx, key, 10*time.Minute)
	if err != nil {
		t.Fatalf("GenerateSignedURL() error = %v", err)
	}

	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("fetch signed URL error = %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("signed URL status = %d, want 200", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !bytes.Equal(body, content) {
		t.Fatalf("isi file dari signed URL tidak cocok")
	}
}
