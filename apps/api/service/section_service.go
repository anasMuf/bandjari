package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"fmt"

	"gorm.io/gorm"
)

type SectionService interface {
	Create(userID uint, isAdmin bool, songID uint, req dto.CreateSectionRequest) (*dto.SectionResponse, error)
	Update(userID uint, isAdmin bool, sectionID uint, req dto.UpdateSectionRequest) (*dto.SectionResponse, error)
	Reorder(userID uint, isAdmin bool, sectionID uint, newIndex int) ([]dto.SectionResponse, error)
	Delete(userID uint, isAdmin bool, sectionID uint) error
	Duplicate(userID uint, isAdmin bool, sectionID uint) (*dto.SectionResponse, error)
}

type sectionService struct {
	sectionRepo repository.SectionRepository
	songRepo    repository.SongRepository
	// sampleRepo dicadangkan untuk auto-attach Sample Template System saat
	// Section dibuat (FR-SLOT-09/AC-10) — sementara dinonaktifkan (slot kosong).
	sampleRepo repository.SampleRepository
}

func NewSectionService(sectionRepo repository.SectionRepository, songRepo repository.SongRepository, sampleRepo repository.SampleRepository) SectionService {
	return &sectionService{sectionRepo: sectionRepo, songRepo: songRepo, sampleRepo: sampleRepo}
}

func toSectionResponse(section *model.Section) *dto.SectionResponse {
	res := &dto.SectionResponse{
		ID:            section.ID,
		SongID:        section.SongID,
		Name:          section.Name,
		OrderIndex:    section.OrderIndex,
		BpmOverride:   section.BpmOverride,
		Loop:          section.Loop,
		NextMode:      section.NextMode,
		NextSectionID: section.NextSectionID,
		// Selalu [] (bukan null) — konsisten dengan kontrak SoundSlots.
		Parts: make([]dto.SectionPartResponse, 0),
	}
	for i := range section.Parts {
		res.Parts = append(res.Parts, *toSectionPartResponse(&section.Parts[i]))
	}
	return res
}

// guardSongMutation menerapkan aturan akses TDD 6.8 + FR-ROLE: resource
// bertingkat (Section) mewarisi status akses dari Song induknya — template
// hanya admin, song user hanya pemiliknya.
func (s *sectionService) guardSongMutation(song *model.Song, userID uint, isAdmin bool) error {
	if !canMutateSong(song, userID, isAdmin) {
		return ErrForbidden
	}
	return nil
}

func (s *sectionService) loadGuardedSection(sectionID uint, userID uint, isAdmin bool) (*model.Section, error) {
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
	if err := s.guardSongMutation(song, userID, isAdmin); err != nil {
		return nil, err
	}
	return section, nil
}

// Create menambah Section baru dan otomatis membuat tepat 5 SectionPart
// (satu per Part) — FR-SEC-01/02 — TANPA SoundSlot apa pun.
//
// Catatan keputusan (pemilik produk): grid Sequencer mulai benar-benar kosong;
// jenis bunyi (SoundSlot) dibuat manual oleh user lewat "+ Tambah Bunyi"
// (FR-SLOT-01). Pembuatan slot default + auto-attach Sample Template System
// (FR-SLOT-09 / AC-10) ditunda sampai susunan standar final.
func (s *sectionService) Create(userID uint, isAdmin bool, songID uint, req dto.CreateSectionRequest) (*dto.SectionResponse, error) {
	song, err := s.songRepo.FindByID(songID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if err := s.guardSongMutation(song, userID, isAdmin); err != nil {
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
		// Default: section diulang terus. User bisa set Loop=false (sekali lalu
		// lanjut otomatis) lewat Update.
		Loop:     true,
		NextMode: string(model.NextModeOrder),
	}
	for _, part := range model.AllParts {
		section.Parts = append(section.Parts, model.SectionPart{Part: part})
	}

	if err := s.sectionRepo.Create(section); err != nil {
		return nil, err
	}
	return toSectionResponse(section), nil
}

func (s *sectionService) Update(userID uint, isAdmin bool, sectionID uint, req dto.UpdateSectionRequest) (*dto.SectionResponse, error) {
	section, err := s.loadGuardedSection(sectionID, userID, isAdmin)
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
	if req.Loop != nil {
		// false = mainkan sekali lalu lanjut sesuai next_mode.
		section.Loop = *req.Loop
	}
	if req.NextSectionID != nil && req.NextMode == nil {
		// next_section_id hanya bermakna bersama next_mode=target.
		return nil, ErrBadRequest
	}
	if req.NextMode != nil {
		switch model.NextMode(*req.NextMode) {
		case model.NextModeOrder, model.NextModeEnd:
			// Mode ini tidak butuh target; kosongkan target bila ada.
			section.NextMode = *req.NextMode
			section.NextSectionID = nil
		case model.NextModeTarget:
			if req.NextSectionID == nil || *req.NextSectionID == sectionID {
				return nil, ErrBadRequest
			}
			target, err := s.sectionRepo.FindByID(*req.NextSectionID)
			if err != nil || target.SongID != section.SongID {
				return nil, ErrBadRequest
			}
			section.NextMode = *req.NextMode
			section.NextSectionID = req.NextSectionID
		default:
			return nil, ErrBadRequest
		}
	}

	if err := s.sectionRepo.Save(section); err != nil {
		return nil, err
	}
	return toSectionResponse(section), nil
}

// Reorder memindahkan Section ke posisi baru dan menormalkan ulang
// order_index seluruh Section dalam Song (transaksional) — FR-SEC-04.
func (s *sectionService) Reorder(userID uint, isAdmin bool, sectionID uint, newIndex int) ([]dto.SectionResponse, error) {
	section, err := s.loadGuardedSection(sectionID, userID, isAdmin)
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

func (s *sectionService) Delete(userID uint, isAdmin bool, sectionID uint) error {
	if _, err := s.loadGuardedSection(sectionID, userID, isAdmin); err != nil {
		return err
	}
	// ClearNextTarget + Delete dalam satu transaksi: bila salah satu gagal,
	// tidak ada referensi setengah dibersihkan atau target terhapus tanpa
	// pembersihan pointer next_mode=target (dangling reference).
	//
	// Cascade soft-delete (kebijakan data): SectionPart & SoundSlot anak ikut
	// dihapus lunak agar tidak menjadi baris aktif yatim — dan agar referensi
	// Sample dari slot di section terhapus tidak lagi memblokir penghapusan
	// Sample (FR-SAMP-08) oleh referensi tak terlihat.
	return s.sectionRepo.WithTransaction(func(tx repository.SectionRepository) error {
		// Section lain yang menjadikan section ini tujuan lanjut (next_mode=target)
		// dikembalikan ke mode default "order" agar tidak menunjuk section terhapus.
		if err := tx.ClearNextTarget(sectionID); err != nil {
			return err
		}
		// Hapus anak lebih dulu (slot → part), baru induknya.
		if err := tx.DeleteSlotsBySectionID(sectionID); err != nil {
			return err
		}
		if err := tx.DeletePartsBySectionID(sectionID); err != nil {
			return err
		}
		return tx.Delete(sectionID)
	})
}

// Duplicate menyalin Section (beserta SectionPart & SoundSlot) di akhir
// urutan Song yang sama — FR-SEC-07.
func (s *sectionService) Duplicate(userID uint, isAdmin bool, sectionID uint) (*dto.SectionResponse, error) {
	section, err := s.loadGuardedSection(sectionID, userID, isAdmin)
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
		SongID:        section.SongID,
		Name:          fmt.Sprintf("%s (Salinan)", section.Name),
		OrderIndex:    int(count),
		BpmOverride:   section.BpmOverride,
		Loop:          section.Loop,
		NextMode:      section.NextMode,
		NextSectionID: section.NextSectionID, // target tetap valid (song yang sama)
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

	// Create + UpdateLoop dalam satu transaksi: gagal di salah satunya harus
	// menggagalkan keduanya agar salinan tidak tersimpan dengan loop yang salah.
	if err := s.sectionRepo.WithTransaction(func(tx repository.SectionRepository) error {
		if err := tx.Create(copied); err != nil {
			return err
		}
		if !copied.Loop {
			// GORM melewatkan nilai zero (false) saat INSERT — pastikan loop=false
			// benar-benar tersimpan (kolom punya default true).
			return tx.UpdateLoop(copied.ID, false)
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return toSectionResponse(copied), nil
}
