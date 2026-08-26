package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"api/utility"
	"bytes"
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const sampleSignedURLTTL = 60 * time.Minute

type SampleService interface {
	// Upload: isTemplate=true hanya boleh admin (upload Sample Template System).
	Upload(userID uint, isAdmin bool, isTemplate bool, part model.Part, name string, data []byte) (*dto.SampleResponse, error)
	List(userID uint, part *model.Part) ([]dto.SampleResponse, error)
	ListTemplates(part *model.Part) ([]dto.SampleResponse, error)
	Rename(userID uint, isAdmin bool, sampleID uint, name string) (*dto.SampleResponse, error)
	Delete(userID uint, isAdmin bool, sampleID uint) error
	PlaybackURL(currentUserID *uint, sampleID uint) (string, error)
}

type sampleService struct {
	sampleRepo repository.SampleRepository
	storage    StorageService
}

func NewSampleService(sampleRepo repository.SampleRepository, storage StorageService) SampleService {
	return &sampleService{sampleRepo: sampleRepo, storage: storage}
}

func toSampleResponse(sample *model.Sample) *dto.SampleResponse {
	return &dto.SampleResponse{
		ID:               sample.ID,
		UserID:           sample.UserID,
		IsSystemTemplate: sample.IsSystemTemplate,
		Name:             sample.Name,
		FileSizeBytes:    sample.FileSizeBytes,
		Part:             sample.Part,
	}
}

// Upload memvalidasi file (.wav ≤5MB — FR-SAMP-06), menyimpannya ke object
// storage, lalu mencatat metadata. isTemplate=true membuat Sample Template
// System — hanya boleh admin (FR-ROLE).
func (s *sampleService) Upload(userID uint, isAdmin bool, isTemplate bool, part model.Part, name string, data []byte) (*dto.SampleResponse, error) {
	if isTemplate && !isAdmin {
		return nil, ErrForbidden
	}
	if !model.IsValidPart(part) {
		return nil, ErrBadRequest
	}
	if err := utility.ValidateWavAudio(data); err != nil {
		return nil, err
	}
	if s.storage == nil {
		return nil, fmt.Errorf("object storage belum dikonfigurasi (STORAGE_ENDPOINT/STORAGE_BUCKET)")
	}

	// Template disimpan di prefix samples/system — konsisten dengan seeder.
	prefix := fmt.Sprintf("samples/%d", userID)
	if isTemplate {
		prefix = "samples/system"
	}
	key := fmt.Sprintf("%s/%s.wav", prefix, uuid.NewString())
	if err := s.storage.Upload(context.Background(), key, bytes.NewReader(data), int64(len(data)), "audio/wav"); err != nil {
		return nil, err
	}

	sample := &model.Sample{
		IsSystemTemplate: isTemplate,
		Name:             name,
		ObjectKey:        key,
		FileSizeBytes:    len(data),
		Part:             part,
	}
	if !isTemplate {
		sample.UserID = &userID
	}
	if err := s.sampleRepo.Create(sample); err != nil {
		// Compensating action: file sudah ter-upload tapi insert DB gagal → hapus
		// object-nya (best-effort) agar tidak meninggalkan file yatim di storage
		// yang tidak bisa diidentifikasi dari baris DB manapun.
		if delErr := s.storage.Delete(context.Background(), key); delErr != nil {
			log.Printf("gagal membersihkan object storage %s setelah insert DB gagal: %v", key, delErr)
		}
		return nil, err
	}
	return toSampleResponse(sample), nil
}

func (s *sampleService) List(userID uint, part *model.Part) ([]dto.SampleResponse, error) {
	if part != nil && !model.IsValidPart(*part) {
		return nil, ErrBadRequest
	}
	samples, err := s.sampleRepo.ListByUserID(userID, part)
	if err != nil {
		return nil, err
	}
	res := make([]dto.SampleResponse, 0, len(samples))
	for i := range samples {
		res = append(res, *toSampleResponse(&samples[i]))
	}
	return fillUsageCounts(s.sampleRepo, res), nil
}

// ListTemplates mengembalikan Sample Template System — read-only, dapat diakses
// siapapun (FR-SAMP-11/13/14).
func (s *sampleService) ListTemplates(part *model.Part) ([]dto.SampleResponse, error) {
	if part != nil && !model.IsValidPart(*part) {
		return nil, ErrBadRequest
	}
	samples, err := s.sampleRepo.ListTemplates(part)
	if err != nil {
		return nil, err
	}
	res := make([]dto.SampleResponse, 0, len(samples))
	for i := range samples {
		res = append(res, *toSampleResponse(&samples[i]))
	}
	return fillUsageCounts(s.sampleRepo, res), nil
}

// fillUsageCounts melengkapi meta "Dipakai di N SoundSlot" pada respons daftar
// Sample — dihitung satu query agregat, bukan per-sample (RD-5).
func fillUsageCounts(sampleRepo repository.SampleRepository, res []dto.SampleResponse) []dto.SampleResponse {
	ids := make([]uint, 0, len(res))
	for _, s := range res {
		ids = append(ids, s.ID)
	}
	counts, err := sampleRepo.CountSoundSlotsBySampleIDs(ids)
	if err != nil {
		return res // meta gagal dimuat → tetap kembalikan daftar tanpa usage_count
	}
	for i := range res {
		res[i].UsageCount = counts[res[i].ID]
	}
	return res
}

func (s *sampleService) Rename(userID uint, isAdmin bool, sampleID uint, name string) (*dto.SampleResponse, error) {
	sample, err := s.sampleRepo.FindByID(sampleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	// Template → hanya admin; sample user → hanya pemiliknya (FR-SAMP-12 + FR-ROLE).
	if !canMutateSample(sample, userID, isAdmin) {
		return nil, ErrForbidden
	}
	sample.Name = name
	if err := s.sampleRepo.Save(sample); err != nil {
		return nil, err
	}
	return toSampleResponse(sample), nil
}

// Delete menolak (409) selama Sample masih direferensikan SoundSlot manapun
// (FR-SAMP-08). Template hanya boleh dihapus admin (FR-SAMP-12 + FR-ROLE).
func (s *sampleService) Delete(userID uint, isAdmin bool, sampleID uint) error {
	sample, err := s.sampleRepo.FindByID(sampleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return ErrNotFound
		}
		return err
	}
	if !canMutateSample(sample, userID, isAdmin) {
		return ErrForbidden
	}

	count, err := s.sampleRepo.CountReferencedBySoundSlots(sampleID)
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrConflict // masih dipakai — User wajib melepas referensi dulu (FR-SAMP-08)
	}

	if err := s.sampleRepo.Delete(sampleID); err != nil {
		return err
	}
	if s.storage != nil {
		if err := s.storage.Delete(context.Background(), sample.ObjectKey); err != nil {
			log.Printf("gagal menghapus object storage %s: %v", sample.ObjectKey, err)
		}
	}
	return nil
}

// PlaybackURL menghasilkan signed URL 60 menit. Sample Template System boleh
// diakses siapapun (mendukung playback Guest); Sample milik User hanya
// pemiliknya — KECUALI sample yang dipakai lagu publik (atau template): lagu
// publik harus benar-benar bisa dimainkan Guest, jadi audio-nya ikut dibagikan
// (FR-VIS). Saat lagu di-private-kan lagi, akses Guest otomatis hilang.
func (s *sampleService) PlaybackURL(currentUserID *uint, sampleID uint) (string, error) {
	if s.storage == nil {
		return "", fmt.Errorf("object storage belum dikonfigurasi (STORAGE_ENDPOINT/STORAGE_BUCKET)")
	}
	sample, err := s.sampleRepo.FindByID(sampleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", ErrNotFound
		}
		return "", err
	}
	if sample.IsSystemTemplate {
		return s.storage.GenerateSignedURL(context.Background(), sample.ObjectKey, sampleSignedURLTTL)
	}
	usedByPublicSong, err := s.sampleRepo.IsReferencedByPublicSong(sampleID)
	if err != nil {
		return "", err
	}
	if usedByPublicSong {
		return s.storage.GenerateSignedURL(context.Background(), sample.ObjectKey, sampleSignedURLTTL)
	}
	if currentUserID == nil || sample.UserID == nil || *sample.UserID != *currentUserID {
		return "", ErrForbidden // NFR-04
	}
	return s.storage.GenerateSignedURL(context.Background(), sample.ObjectKey, sampleSignedURLTTL)
}
