package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"fmt"

	"gorm.io/gorm"
)

type SongService interface {
	Create(userID uint, isAdmin bool, req dto.CreateSongRequest) (*dto.SongResponse, error)
	List(userID uint) ([]dto.SongResponse, error)
	ListTemplates() ([]dto.SongResponse, error)
	// ListPublic mengembalikan lagu publik (non-template) untuk Explore —
	// termasuk author_name pemiliknya (FR-VIS).
	ListPublic() ([]dto.SongResponse, error)
	GetByID(songID uint, currentUserID *uint) (*dto.SongResponse, error)
	Update(userID uint, isAdmin bool, songID uint, req dto.UpdateSongRequest) (*dto.SongResponse, error)
	// SetVisibility mengubah status public/private — hanya admin pemilik lagu (FR-VIS).
	SetVisibility(userID uint, isAdmin bool, songID uint, visibility string) (*dto.SongResponse, error)
	Delete(userID uint, isAdmin bool, songID uint) error
	Duplicate(userID uint, songID uint) (*dto.SongResponse, error)
}

type songService struct {
	songRepo repository.SongRepository
}

func NewSongService(songRepo repository.SongRepository) SongService {
	return &songService{songRepo: songRepo}
}

func toSongResponse(song *model.Song) *dto.SongResponse {
	res := &dto.SongResponse{
		ID:               song.ID,
		UserID:           song.UserID,
		IsSystemTemplate: song.IsSystemTemplate,
		Visibility:       song.Visibility,
		Name:             song.Name,
		Bpm:              song.Bpm,
		SectionCount:     len(song.Sections),
		UpdatedAt:        song.UpdatedAt,
	}
	// AuthorName terisi saat relasi Author di-load (daftar lagu publik).
	if song.Author != nil {
		res.AuthorName = song.Author.Name
	}
	for i := range song.Sections {
		res.Sections = append(res.Sections, *toSectionResponse(&song.Sections[i]))
	}
	return res
}

// Create membuat Song baru. Admin boleh membuat Song Template System lewat
// req.IsSystemTemplate=true; user biasa selalu membuat Song miliknya.
func (s *songService) Create(userID uint, isAdmin bool, req dto.CreateSongRequest) (*dto.SongResponse, error) {
	asTemplate := req.IsSystemTemplate != nil && *req.IsSystemTemplate
	if asTemplate && !isAdmin {
		return nil, ErrForbidden // hanya admin yang boleh membuat template (FR-ROLE)
	}
	// FR-VIS: default private. Hanya admin yang boleh mempublikasikan lagu saat
	// dibuat — non-admin yang mengirim "public" ditolak (konsisten dengan template).
	visibility := string(model.VisibilityPrivate)
	if req.Visibility != nil {
		if *req.Visibility == string(model.VisibilityPublic) && !isAdmin {
			return nil, ErrForbidden
		}
		visibility = *req.Visibility
	}
	song := &model.Song{
		IsSystemTemplate: asTemplate,
		Visibility:       visibility,
		Name:             req.Name,
		Bpm:              req.Bpm,
	}
	if !asTemplate {
		song.UserID = &userID
	}
	if err := s.songRepo.Create(song); err != nil {
		return nil, err
	}
	return toSongResponse(song), nil
}

func (s *songService) List(userID uint) ([]dto.SongResponse, error) {
	songs, err := s.songRepo.ListByUserID(userID)
	if err != nil {
		return nil, err
	}
	res := make([]dto.SongResponse, 0, len(songs))
	for i := range songs {
		res = append(res, *toSongResponse(&songs[i]))
	}
	return fillSectionCounts(s.songRepo, res), nil
}

// ListTemplates mengembalikan Song Template System — dapat diakses Guest
// maupun User login (FR-SONG-07/09, FR-AUTH-04).
func (s *songService) ListTemplates() ([]dto.SongResponse, error) {
	songs, err := s.songRepo.ListTemplates()
	if err != nil {
		return nil, err
	}
	res := make([]dto.SongResponse, 0, len(songs))
	for i := range songs {
		res = append(res, *toSongResponse(&songs[i]))
	}
	return fillSectionCounts(s.songRepo, res), nil
}

// ListPublic mengembalikan lagu publik milik user (FR-VIS) — data Explore
// selain "Lagu Bawaan". Template dikecualikan (ditangani ListTemplates).
func (s *songService) ListPublic() ([]dto.SongResponse, error) {
	songs, err := s.songRepo.ListPublic()
	if err != nil {
		return nil, err
	}
	res := make([]dto.SongResponse, 0, len(songs))
	for i := range songs {
		res = append(res, *toSongResponse(&songs[i]))
	}
	return fillSectionCounts(s.songRepo, res), nil
}

// fillSectionCounts melengkapi meta "N Section" pada respons daftar Song
// (relasi Section tidak dimuat di query daftar) — RD-3.
func fillSectionCounts(songRepo repository.SongRepository, res []dto.SongResponse) []dto.SongResponse {
	ids := make([]uint, 0, len(res))
	for _, s := range res {
		ids = append(ids, s.ID)
	}
	counts, err := songRepo.CountSectionsBySongIDs(ids)
	if err != nil {
		return res // meta gagal dimuat → tetap kembalikan daftar tanpa section_count
	}
	for i := range res {
		res[i].SectionCount = int(counts[res[i].ID])
	}
	return res
}

// GetByID menerapkan matriks akses TDD Bagian 6.8 (+FR-VIS):
// - Song Template System → boleh diakses siapapun (Guest maupun User)
// - Lagu public (visibility=public) → boleh diakses siapapun (FR-VIS)
// - Lagu private milik User → hanya pemiliknya; Guest dapat 404 (tanpa membocorkan keberadaan)
func (s *songService) GetByID(songID uint, currentUserID *uint) (*dto.SongResponse, error) {
	song, err := s.songRepo.FindByIDWithSections(songID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}

	if song.IsSystemTemplate || song.Visibility == string(model.VisibilityPublic) {
		return toSongResponse(song), nil // FR-AUTH-04 / FR-VIS
	}
	if currentUserID == nil {
		return nil, ErrNotFound // Guest coba akses lagu pribadi → 404 (FR-AUTH-05)
	}
	if song.UserID == nil || *song.UserID != *currentUserID {
		return nil, ErrForbidden // bukan pemilik → 403 (FR-AUTH-02)
	}
	return toSongResponse(song), nil
}

func (s *songService) Update(userID uint, isAdmin bool, songID uint, req dto.UpdateSongRequest) (*dto.SongResponse, error) {
	song, err := s.songRepo.FindByID(songID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	// Template → hanya admin; song user → hanya pemiliknya (FR-SONG-08 + FR-ROLE).
	if !canMutateSong(song, userID, isAdmin) {
		return nil, ErrForbidden
	}
	if req.Name != nil {
		song.Name = *req.Name
	}
	if req.Bpm != nil {
		song.Bpm = *req.Bpm
	}
	if err := s.songRepo.Save(song); err != nil {
		return nil, err
	}
	return toSongResponse(song), nil
}

// SetVisibility mengubah status public/private sebuah lagu (FR-VIS). Hanya
// admin PEMILIK lagu yang boleh; template (tanpa pemilik) selalu publik dan
// tidak bisa diubah statusnya.
func (s *songService) SetVisibility(userID uint, isAdmin bool, songID uint, visibility string) (*dto.SongResponse, error) {
	song, err := s.songRepo.FindByID(songID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if !canSetVisibility(song, userID, isAdmin) {
		return nil, ErrForbidden
	}
	song.Visibility = visibility
	if err := s.songRepo.Save(song); err != nil {
		return nil, err
	}
	return toSongResponse(song), nil
}

func (s *songService) Delete(userID uint, isAdmin bool, songID uint) error {
	song, err := s.songRepo.FindByID(songID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return ErrNotFound
		}
		return err
	}
	// Template → hanya admin; song user → hanya pemiliknya (FR-SONG-08 + FR-ROLE).
	if !canMutateSong(song, userID, isAdmin) {
		return ErrForbidden
	}
	// Cascade soft-delete (kebijakan data): Section → SectionPart → SoundSlot
	// anak ikut dihapus lunak dalam transaksi yang sama dengan Song. Tanpa ini,
	// anak tetap aktif (soft delete tidak memicu ON DELETE CASCADE DB) dan
	// referensi Sample dari slot di song terhapus tetap memblokir penghapusan
	// Sample (FR-SAMP-08) oleh referensi tak terlihat.
	return s.songRepo.WithTransaction(func(tx repository.SongRepository) error {
		// Hapus anak lebih dulu (slot → part → section), baru induknya.
		if err := tx.DeleteSlotsBySongID(songID); err != nil {
			return err
		}
		if err := tx.DeletePartsBySongID(songID); err != nil {
			return err
		}
		if err := tx.DeleteSectionsBySongID(songID); err != nil {
			return err
		}
		return tx.Delete(songID)
	})
}

// Duplicate menyalin Song beserta Section/SectionPart/SoundSlot (deep copy).
// Berlaku untuk Song milik User (pemilik saja) maupun Song Template System
// (user login manapun) — hasil selalu milik user, is_system_template = false.
func (s *songService) Duplicate(userID uint, songID uint) (*dto.SongResponse, error) {
	song, err := s.songRepo.FindByIDWithSections(songID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if !song.IsSystemTemplate && (song.UserID == nil || *song.UserID != userID) {
		return nil, ErrForbidden
	}

	copied := &model.Song{
		UserID:           &userID,
		IsSystemTemplate: false,
		Name:             fmt.Sprintf("%s (Salinan)", song.Name),
		Bpm:              song.Bpm,
	}
	oldIDs := make([]uint, 0, len(song.Sections))
	for _, sec := range song.Sections {
		oldIDs = append(oldIDs, sec.ID)
		newSec := model.Section{
			Name:        sec.Name,
			OrderIndex:  sec.OrderIndex,
			BpmOverride: sec.BpmOverride,
			Loop:        sec.Loop,
			NextMode:    sec.NextMode,
			// NextSectionID di-remap setelah seluruh Section dibuat — ID baru
			// belum diketahui saat ini.
		}
		for _, part := range sec.Parts {
			newPart := model.SectionPart{
				Part:  part.Part,
				Steps: part.Steps,
			}
			for _, slot := range part.SoundSlots {
				newPart.SoundSlots = append(newPart.SoundSlots, model.SoundSlot{
					Label:      slot.Label,
					Key:        slot.Key,
					SampleID:   slot.SampleID, // referensi Sample dipertahankan (FR-SAMP-04)
					OrderIndex: slot.OrderIndex,
				})
			}
			newSec.Parts = append(newSec.Parts, newPart)
		}
		copied.Sections = append(copied.Sections, newSec)
	}

	// Seluruh deep copy + remap next_section_id berjalan dalam SATU transaksi:
	// bila salah satu UPDATE gagal di tengah, song salinan ikut dibatalkan
	// (rollback) sehingga tidak mungkin ada salinan dengan pointer ke section
	// song asal (korupsi lintas-song).
	if err := s.songRepo.WithTransaction(func(tx repository.SongRepository) error {
		if err := tx.Create(copied); err != nil {
			return err
		}

		// Remap next_section_id: section hasil duplikasi yang menunjuk target
		// tertentu harus menunjuk salinan targetnya (bukan section asal).
		idMap := make(map[uint]uint, len(oldIDs))
		for i := range copied.Sections {
			if i < len(oldIDs) {
				idMap[oldIDs[i]] = copied.Sections[i].ID
			}
		}
		for i, sec := range song.Sections {
			// GORM melewatkan nilai zero (false) saat INSERT — pastikan loop=false
			// benar-benar tersimpan pada section salinan (kolom punya default true).
			if !sec.Loop {
				if err := tx.UpdateSectionLoop(copied.Sections[i].ID, false); err != nil {
					return err
				}
			}

			if sec.NextMode != string(model.NextModeTarget) || sec.NextSectionID == nil {
				continue
			}
			newTarget, ok := idMap[*sec.NextSectionID]
			if !ok {
				// Target tidak ikut terduplikasi → kembalikan ke mode default.
				if err := tx.UpdateSectionNextTarget(copied.Sections[i].ID, string(model.NextModeOrder), nil); err != nil {
					return err
				}
				copied.Sections[i].NextMode = string(model.NextModeOrder)
				copied.Sections[i].NextSectionID = nil
				continue
			}
			if err := tx.UpdateSectionNextTarget(copied.Sections[i].ID, string(model.NextModeTarget), &newTarget); err != nil {
				return err
			}
			copied.Sections[i].NextMode = string(model.NextModeTarget)
			copied.Sections[i].NextSectionID = &newTarget
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return toSongResponse(copied), nil
}
