package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"fmt"

	"gorm.io/gorm"
)

type SectionService interface {
	Create(userID uint, songID uint, req dto.CreateSectionRequest) (*dto.SectionResponse, error)
	Update(userID uint, sectionID uint, req dto.UpdateSectionRequest) (*dto.SectionResponse, error)
	Reorder(userID uint, sectionID uint, newIndex int) ([]dto.SectionResponse, error)
	Delete(userID uint, sectionID uint) error
	Duplicate(userID uint, sectionID uint) (*dto.SectionResponse, error)
}

type sectionService struct {
	sectionRepo repository.SectionRepository
	songRepo    repository.SongRepository
	sampleRepo  repository.SampleRepository
}

func NewSectionService(sectionRepo repository.SectionRepository, songRepo repository.SongRepository, sampleRepo repository.SampleRepository) SectionService {
	return &sectionService{sectionRepo: sectionRepo, songRepo: songRepo, sampleRepo: sampleRepo}
}

func toSectionResponse(section *model.Section) *dto.SectionResponse {
	return &dto.SectionResponse{
		ID:          section.ID,
		SongID:      section.SongID,
		Name:        section.Name,
		OrderIndex:  section.OrderIndex,
		BpmOverride: section.BpmOverride,
	}
}

// guardSongMutation menerapkan aturan akses TDD 6.8: resource bertingkat
// (Section) mewarisi status akses dari Song induknya.
func (s *sectionService) guardSongMutation(song *model.Song, userID uint) error {
	if song.IsSystemTemplate || song.UserID == nil || *song.UserID != userID {
		return ErrForbidden
	}
	return nil
}

func (s *sectionService) loadGuardedSection(sectionID uint, userID uint) (*model.Section, error) {
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
	if err := s.guardSongMutation(song, userID); err != nil {
		return nil, err
	}
	return section, nil
}

// Create menambah Section baru dan otomatis membuat tepat 5 SectionPart
// (satu per Part) — FR-SEC-01/02. Tiap SectionPart mendapat 2 SoundSlot default
// ("Tak"/T, "Dung"/D) yang langsung terpasang Sample Template System bila
// tersedia untuk part+label terkait (FR-SLOT-09, FR-SAMP-11); bila tidak ada,
// SampleID tetap NULL tanpa error (FR-SAMP-07).
func (s *sectionService) Create(userID uint, songID uint, req dto.CreateSectionRequest) (*dto.SectionResponse, error) {
	song, err := s.songRepo.FindByID(songID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if err := s.guardSongMutation(song, userID); err != nil {
		return nil, err
	}

	count, err := s.sectionRepo.CountBySongID(songID)
	if err != nil {
		return nil, err
	}

	section := &model.Section{
		SongID:     songID,
		Name:       req.Name,
		OrderIndex: int(count),
	}
	for _, part := range model.AllParts {
		sp := model.SectionPart{Part: part}
		for _, def := range defaultSoundSlots {
			slot := model.SoundSlot{Label: def.label, Key: def.key, OrderIndex: len(sp.SoundSlots)}
			if template, err := s.sampleRepo.FindTemplateByPartAndLabel(part, def.label); err == nil && template.ID != 0 {
				sampleID := template.ID
				slot.SampleID = &sampleID
			}
			sp.SoundSlots = append(sp.SoundSlots, slot)
		}
		section.Parts = append(section.Parts, sp)
	}

	if err := s.sectionRepo.Create(section); err != nil {
		return nil, err
	}
	return toSectionResponse(section), nil
}

// defaultSoundSlots — pasangan SoundSlot bawaan saat SectionPart dibuat (FR-SLOT-09).
var defaultSoundSlots = []struct{ label, key string }{
	{label: "Tak", key: "T"},
	{label: "Dung", key: "D"},
}

func (s *sectionService) Update(userID uint, sectionID uint, req dto.UpdateSectionRequest) (*dto.SectionResponse, error) {
	section, err := s.loadGuardedSection(sectionID, userID)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		section.Name = *req.Name
	}
	if req.BpmOverride != nil && req.BpmOverride.Set {
		if req.BpmOverride.Value != nil && (*req.BpmOverride.Value < 20 || *req.BpmOverride.Value > 400) {
			return nil, ErrBadRequest
		}
		section.BpmOverride = req.BpmOverride.Value
	}

	if err := s.sectionRepo.Save(section); err != nil {
		return nil, err
	}
	return toSectionResponse(section), nil
}

// Reorder memindahkan Section ke posisi baru dan menormalkan ulang
// order_index seluruh Section dalam Song (transaksional) — FR-SEC-04.
func (s *sectionService) Reorder(userID uint, sectionID uint, newIndex int) ([]dto.SectionResponse, error) {
	section, err := s.loadGuardedSection(sectionID, userID)
	if err != nil {
		return nil, err
	}

	sections, err := s.sectionRepo.ListBySongID(section.SongID)
	if err != nil {
		return nil, err
	}
	if len(sections) == 0 {
		return nil, ErrNotFound
	}

	// Pisahkan section target, sisipkan di posisi baru (clamped)
	targetIdx := -1
	rest := make([]model.Section, 0, len(sections)-1)
	for i, sec := range sections {
		if sec.ID == sectionID {
			targetIdx = i
			continue
		}
		rest = append(rest, sec)
	}
	if targetIdx == -1 {
		return nil, ErrNotFound
	}
	if newIndex < 0 {
		newIndex = 0
	}
	if newIndex > len(rest) {
		newIndex = len(rest)
	}

	ordered := make([]model.Section, 0, len(sections))
	ordered = append(ordered, rest[:newIndex]...)
	ordered = append(ordered, sections[targetIdx])
	ordered = append(ordered, rest[newIndex:]...)

	err = s.sectionRepo.WithTransaction(func(tx repository.SectionRepository) error {
		for i := range ordered {
			if err := tx.UpdateOrderIndex(ordered[i].ID, i); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	res := make([]dto.SectionResponse, 0, len(ordered))
	for i := range ordered {
		ordered[i].OrderIndex = i
		res = append(res, *toSectionResponse(&ordered[i]))
	}
	return res, nil
}

func (s *sectionService) Delete(userID uint, sectionID uint) error {
	if _, err := s.loadGuardedSection(sectionID, userID); err != nil {
		return err
	}
	return s.sectionRepo.Delete(sectionID)
}

// Duplicate menyalin Section (beserta SectionPart & SoundSlot) di akhir
// urutan Song yang sama — FR-SEC-07.
func (s *sectionService) Duplicate(userID uint, sectionID uint) (*dto.SectionResponse, error) {
	section, err := s.loadGuardedSection(sectionID, userID)
	if err != nil {
		return nil, err
	}

	source, err := s.sectionRepo.FindByIDWithParts(sectionID)
	if err != nil {
		return nil, err
	}

	count, err := s.sectionRepo.CountBySongID(section.SongID)
	if err != nil {
		return nil, err
	}

	copied := &model.Section{
		SongID:      section.SongID,
		Name:        fmt.Sprintf("%s (Salinan)", section.Name),
		OrderIndex:  int(count),
		BpmOverride: section.BpmOverride,
	}
	for _, part := range source.Parts {
		newPart := model.SectionPart{
			Part:  part.Part,
			Steps: part.Steps,
		}
		for _, slot := range part.SoundSlots {
			newPart.SoundSlots = append(newPart.SoundSlots, model.SoundSlot{
				Label:      slot.Label,
				Key:        slot.Key,
				SampleID:   slot.SampleID,
				OrderIndex: slot.OrderIndex,
			})
		}
		copied.Parts = append(copied.Parts, newPart)
	}

	if err := s.sectionRepo.Create(copied); err != nil {
		return nil, err
	}
	return toSectionResponse(copied), nil
}
