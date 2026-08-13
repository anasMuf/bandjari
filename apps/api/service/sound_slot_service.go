package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"api/utility"
	"strings"

	"gorm.io/gorm"
)

type SoundSlotService interface {
	Create(userID uint, sectionPartID uint, req dto.CreateSoundSlotRequest) (*dto.SoundSlotResponse, error)
	Update(userID uint, slotID uint, req dto.UpdateSoundSlotRequest) (*dto.SoundSlotResponse, error)
	Delete(userID uint, slotID uint) error
}

type soundSlotService struct {
	slotRepo    repository.SoundSlotRepository
	partRepo    repository.SectionPartRepository
	sectionRepo repository.SectionRepository
	songRepo    repository.SongRepository
	sampleRepo  repository.SampleRepository
}

func NewSoundSlotService(
	slotRepo repository.SoundSlotRepository,
	partRepo repository.SectionPartRepository,
	sectionRepo repository.SectionRepository,
	songRepo repository.SongRepository,
	sampleRepo repository.SampleRepository,
) SoundSlotService {
	return &soundSlotService{
		slotRepo: slotRepo, partRepo: partRepo, sectionRepo: sectionRepo,
		songRepo: songRepo, sampleRepo: sampleRepo,
	}
}

func toSoundSlotResponse(slot *model.SoundSlot) *dto.SoundSlotResponse {
	res := &dto.SoundSlotResponse{
		ID:            slot.ID,
		SectionPartID: slot.SectionPartID,
		Label:         slot.Label,
		Key:           slot.Key,
		SampleID:      slot.SampleID,
		OrderIndex:    slot.OrderIndex,
	}
	if slot.Sample != nil {
		res.Sample = &dto.SampleRefResponse{
			ID:               slot.Sample.ID,
			Name:             slot.Sample.Name,
			IsSystemTemplate: slot.Sample.IsSystemTemplate,
		}
	}
	return res
}

// loadGuardedPart memuat SectionPart beserta rantai Section → Song dan
// menerapkan aturan akses (mutasi diwarisi dari Song induk — TDD 6.8).
func (s *soundSlotService) loadGuardedPart(partID uint, userID uint) (*model.SectionPart, error) {
	part, err := s.partRepo.FindByID(partID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	section, err := s.sectionRepo.FindByID(part.SectionID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	song, err := s.songRepo.FindByID(section.SongID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if song.IsSystemTemplate || song.UserID == nil || *song.UserID != userID {
		return nil, ErrForbidden
	}
	return part, nil
}

// validateSampleAccess memastikan sample yang dipasangkan dapat diakses user:
// template → bebas; milik user → hanya pemiliknya (FR-SLOT-07, FR-SAMP-13).
func (s *soundSlotService) validateSampleAccess(userID uint, sampleID uint) error {
	sample, err := s.sampleRepo.FindByID(sampleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return ErrNotFound
		}
		return err
	}
	if sample.IsSystemTemplate {
		return nil
	}
	if sample.UserID == nil || *sample.UserID != userID {
		return ErrForbidden
	}
	return nil
}

// keyUsedInSteps mengecek apakah key masih dipakai di dalam steps SectionPart.
// Format steps: key dipisah koma (mis. "T,D,KD") — cocokkan token utuh,
// bukan per karakter, agar key 2 karakter tidak tertukar dengan key 1 karakter.
func keyUsedInSteps(steps *string, key string) bool {
	if steps == nil || *steps == "" {
		return false
	}
	for _, token := range strings.Split(*steps, ",") {
		if token == key {
			return true
		}
	}
	return false
}

func (s *soundSlotService) Create(userID uint, sectionPartID uint, req dto.CreateSoundSlotRequest) (*dto.SoundSlotResponse, error) {
	if _, err := s.loadGuardedPart(sectionPartID, userID); err != nil {
		return nil, err
	}

	// Format key: 1–2 karakter alfanumerik, tanpa koma/spasi (FR-SLOT-02).
	if err := utility.ValidateSoundSlotKey(req.Key); err != nil {
		return nil, ErrBadRequest
	}

	// key unik dalam lingkup SectionPart yang sama (FR-SLOT-02) → 400
	count, err := s.slotRepo.CountByKey(sectionPartID, req.Key)
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrBadRequest
	}

	if req.SampleID != nil {
		if err := s.validateSampleAccess(userID, *req.SampleID); err != nil {
			return nil, err
		}
	}

	maxOrder, err := s.slotRepo.MaxOrderIndex(sectionPartID)
	if err != nil {
		return nil, err
	}

	slot := &model.SoundSlot{
		SectionPartID: sectionPartID,
		Label:         req.Label,
		Key:           req.Key,
		SampleID:      req.SampleID,
		OrderIndex:    maxOrder + 1,
	}
	if err := s.slotRepo.Create(slot); err != nil {
		return nil, err
	}
	return toSoundSlotResponse(slot), nil
}

func (s *soundSlotService) Update(userID uint, slotID uint, req dto.UpdateSoundSlotRequest) (*dto.SoundSlotResponse, error) {
	slot, err := s.slotRepo.FindByID(slotID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	part, err := s.loadGuardedPart(slot.SectionPartID, userID)
	if err != nil {
		return nil, err
	}

	if req.Label != nil {
		slot.Label = *req.Label
	}

	if req.Key != nil && *req.Key != slot.Key {
		// format key baru harus valid 1–2 karakter alfanumerik
		if err := utility.ValidateSoundSlotKey(*req.Key); err != nil {
			return nil, ErrBadRequest
		}
		// tolak ubah key yang masih dipakai di steps (FR-SLOT-06) → 400
		if keyUsedInSteps(part.Steps, slot.Key) {
			return nil, ErrBadRequest
		}
		// key baru harus unik dalam lingkup SectionPart (FR-SLOT-02) → 400
		count, err := s.slotRepo.CountByKeyExcluding(slot.SectionPartID, *req.Key, slot.ID)
		if err != nil {
			return nil, err
		}
		if count > 0 {
			return nil, ErrBadRequest
		}
		slot.Key = *req.Key
	}

	if req.SampleID != nil && req.SampleID.Set {
		if req.SampleID.Value != nil {
			if err := s.validateSampleAccess(userID, *req.SampleID.Value); err != nil {
				return nil, err
			}
			slot.SampleID = req.SampleID.Value
		} else {
			slot.SampleID = nil // lepas referensi sample (FR-SAMP-10)
		}
	}

	if err := s.slotRepo.Save(slot); err != nil {
		return nil, err
	}
	return toSoundSlotResponse(slot), nil
}

// Delete menolak (409) bila key SoundSlot masih dipakai di steps (FR-SLOT-05/06).
func (s *soundSlotService) Delete(userID uint, slotID uint) error {
	slot, err := s.slotRepo.FindByID(slotID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return ErrNotFound
		}
		return err
	}
	part, err := s.loadGuardedPart(slot.SectionPartID, userID)
	if err != nil {
		return err
	}
	if keyUsedInSteps(part.Steps, slot.Key) {
		return ErrConflict
	}
	return s.slotRepo.Delete(slotID)
}
