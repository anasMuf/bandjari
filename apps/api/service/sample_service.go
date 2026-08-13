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
	Upload(userID uint, part model.Part, name string, data []byte) (*dto.SampleResponse, error)
	List(userID uint, part *model.Part) ([]dto.SampleResponse, error)
	ListTemplates(part *model.Part) ([]dto.SampleResponse, error)
	Rename(userID uint, sampleID uint, name string) (*dto.SampleResponse, error)
	Delete(userID uint, sampleID uint) error
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
// storage, lalu mencatat metadata sebagai Sample independen milik user
// (FR-SAMP-01/02/03).
func (s *sampleService) Upload(userID uint, part model.Part, name string, data []byte) (*dto.SampleResponse, error) {
	if !model.IsValidPart(part) {
		return nil, ErrBadRequest
	}
	if err := utility.ValidateWavAudio(data); err != nil {
		return nil, err
	}
	if s.storage == nil {
		return nil, fmt.Errorf("object storage belum dikonfigurasi (STORAGE_ENDPOINT/STORAGE_BUCKET)")
	}

	key := fmt.Sprintf("samples/%d/%s.wav", userID, uuid.NewString())
	if err := s.storage.Upload(context.Background(), key, bytes.NewReader(data), int64(len(data)), "audio/wav"); err != nil {
		return nil, err
	}

	sample := &model.Sample{
		UserID:           &userID,
		IsSystemTemplate: false,
		Name:             name,
		ObjectKey:        key,
		FileSizeBytes:    len(data),
		Part:             part,
	}
	if err := s.sampleRepo.Create(sample); err != nil {
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
	return res, nil
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
	return res, nil
}

func (s *sampleService) Rename(userID uint, sampleID uint, name string) (*dto.SampleResponse, error) {
	sample, err := s.sampleRepo.FindByID(sampleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if sample.IsSystemTemplate || sample.UserID == nil || *sample.UserID != userID {
		return nil, ErrForbidden // FR-SAMP-12 + FR-AUTH-02
	}
	sample.Name = name
	if err := s.sampleRepo.Save(sample); err != nil {
		return nil, err
	}
	return toSampleResponse(sample), nil
}

// Delete menolak (409) selama Sample masih direferensikan SoundSlot manapun
// (FR-SAMP-08), dan menolak (403) Sample Template System (FR-SAMP-12).
func (s *sampleService) Delete(userID uint, sampleID uint) error {
	sample, err := s.sampleRepo.FindByID(sampleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return ErrNotFound
		}
		return err
	}
	if sample.IsSystemTemplate {
		return ErrForbidden
	}
	if sample.UserID == nil || *sample.UserID != userID {
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
// diakses siapapun (mendukung playback Guest); Sample milik User hanya pemiliknya.
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
	if currentUserID == nil || sample.UserID == nil || *sample.UserID != *currentUserID {
		return "", ErrForbidden // NFR-04
	}
	return s.storage.GenerateSignedURL(context.Background(), sample.ObjectKey, sampleSignedURLTTL)
}
