package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"api/utility"

	"gorm.io/gorm"
)

type SectionPartService interface {
	ListBySection(currentUserID *uint, sectionID uint) ([]dto.SectionPartResponse, error)
	UpdateSteps(userID uint, isAdmin bool, partID uint, req dto.UpdateStepsRequest) (*dto.SectionPartResponse, error)
}

type sectionPartService struct {
	partRepo    repository.SectionPartRepository
	sectionRepo repository.SectionRepository
	songRepo    repository.SongRepository
}

func NewSectionPartService(partRepo repository.SectionPartRepository, sectionRepo repository.SectionRepository, songRepo repository.SongRepository) SectionPartService {
	return &sectionPartService{partRepo: partRepo, sectionRepo: sectionRepo, songRepo: songRepo}
}

func toSectionPartResponse(part *model.SectionPart) *dto.SectionPartResponse {
	res := &dto.SectionPartResponse{
		ID:        part.ID,
		SectionID: part.SectionID,
		Part:      part.Part,
		Steps:     part.Steps,
		// Selalu [] (bukan null) — bagian dari kontrak respons agar klien aman
		// memanggil .length/.map tanpa pengecekan null.
		SoundSlots: make([]dto.SoundSlotResponse, 0),
	}
	for i := range part.SoundSlots {
		res.SoundSlots = append(res.SoundSlots, *toSoundSlotResponse(&part.SoundSlots[i]))
	}
	return res
}

// ListBySection menerapkan akses baca TDD 6.8 + FR-VIS: Section milik Song
// Template atau lagu publik (visibility=public) boleh dilihat siapapun
// (termasuk Guest, read-only); Section milik lagu pribadi hanya pemiliknya.
func (s *sectionPartService) ListBySection(currentUserID *uint, sectionID uint) ([]dto.SectionPartResponse, error) {
	section, err := s.sectionRepo.FindByID(sectionID)
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
	if !song.IsSystemTemplate && song.Visibility != string(model.VisibilityPublic) {
		if currentUserID == nil {
			return nil, ErrNotFound // Guest coba akses lagu pribadi → 404 (FR-AUTH-05)
		}
		if song.UserID == nil || *song.UserID != *currentUserID {
			return nil, ErrForbidden // FR-AUTH-02
		}
	}

	parts, err := s.partRepo.ListBySectionID(sectionID)
	if err != nil {
		return nil, err
	}
	res := make([]dto.SectionPartResponse, 0, len(parts))
	for i := range parts {
		res = append(res, *toSectionPartResponse(&parts[i]))
	}
	return res, nil
}

// UpdateSteps menyimpan rumus pukulan — setiap karakter divalidasi merujuk ke
// key SoundSlot yang terdaftar pada SectionPart terkait (FR-SEQ-02, NFR-05).
func (s *sectionPartService) UpdateSteps(userID uint, isAdmin bool, partID uint, req dto.UpdateStepsRequest) (*dto.SectionPartResponse, error) {
	part, err := s.partRepo.FindByIDWithSlots(partID)
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
	// Template → hanya admin; song user → hanya pemiliknya (FR-ROLE).
	if !canMutateSong(song, userID, isAdmin) {
		return nil, ErrForbidden
	}

	if req.Steps != nil && req.Steps.Set {
		steps := req.Steps.Value
		if steps != nil && *steps != "" {
			keys := make([]string, 0, len(part.SoundSlots))
			for _, slot := range part.SoundSlots {
				keys = append(keys, slot.Key)
			}
			if err := utility.ValidateSteps(*steps, keys); err != nil {
				return nil, ErrBadRequest
			}
		}
		part.Steps = steps
		if err := s.partRepo.Save(part); err != nil {
			return nil, err
		}
	}
	return toSectionPartResponse(part), nil
}
