package repository

import (
	"api/model"

	"gorm.io/gorm"
)

type SongRepository interface {
	Create(song *model.Song) error
	FindByID(id uint) (*model.Song, error)
	FindByIDWithSections(id uint) (*model.Song, error)
	ListByUserID(userID uint) ([]model.Song, error)
	ListTemplates() ([]model.Song, error)
	CountSectionsBySongIDs(songIDs []uint) (map[uint]int64, error)
	// UpdateSectionNextTarget menimpa mode lanjut & target satu Section — dipakai
	// remap next_section_id saat duplikasi Song.
	UpdateSectionNextTarget(sectionID uint, mode string, targetID *uint) error
	// UpdateSectionLoop menimpa nilai loop satu Section — GORM melewatkan nilai
	// zero (false) saat INSERT (kolom punya default true).
	UpdateSectionLoop(sectionID uint, loop bool) error
	Save(song *model.Song) error
	Delete(id uint) error
}

type songRepository struct {
	db *gorm.DB
}

func NewSongRepository(db *gorm.DB) SongRepository {
	return &songRepository{db: db}
}

func (r *songRepository) Create(song *model.Song) error {
	return r.db.Create(song).Error
}

func (r *songRepository) FindByID(id uint) (*model.Song, error) {
	var song model.Song
	err := r.db.First(&song, id).Error
	return &song, err
}

func (r *songRepository) FindByIDWithSections(id uint) (*model.Song, error) {
	var song model.Song
	err := r.db.Preload("Sections.Parts.SoundSlots.Sample").First(&song, id).Error
	return &song, err
}

func (r *songRepository) ListByUserID(userID uint) ([]model.Song, error) {
	var songs []model.Song
	err := r.db.Where("user_id = ? AND is_system_template = false", userID).Order("created_at DESC").Find(&songs).Error
	return songs, err
}

// ListTemplates mengembalikan seluruh Song Template System (FR-SONG-07/09).
func (r *songRepository) ListTemplates() ([]model.Song, error) {
	var songs []model.Song
	err := r.db.Where("is_system_template = true").Order("created_at DESC").Find(&songs).Error
	return songs, err
}

// CountSectionsBySongIDs menghitung jumlah Section (tidak terhapus) per Song
// dalam satu query — dipakai meta "N Section" pada daftar Song tanpa memuat
// seluruh relasi (RD-3).
func (r *songRepository) CountSectionsBySongIDs(songIDs []uint) (map[uint]int64, error) {
	result := make(map[uint]int64, len(songIDs))
	if len(songIDs) == 0 {
		return result, nil
	}
	type row struct {
		SongID uint
		Count  int64
	}
	var rows []row
	err := r.db.Model(&model.Section{}).
		Select("song_id, COUNT(*) AS count").
		Where("song_id IN ?", songIDs).
		Group("song_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.SongID] = r.Count
	}
	return result, nil
}

func (r *songRepository) UpdateSectionNextTarget(sectionID uint, mode string, targetID *uint) error {
	return r.db.Model(&model.Section{}).Where("id = ?", sectionID).
		Updates(map[string]interface{}{"next_mode": mode, "next_section_id": targetID}).Error
}

func (r *songRepository) UpdateSectionLoop(sectionID uint, loop bool) error {
	return r.db.Model(&model.Section{}).Where("id = ?", sectionID).Update("loop", loop).Error
}

func (r *songRepository) Save(song *model.Song) error {
	return r.db.Save(song).Error
}

func (r *songRepository) Delete(id uint) error {
	return r.db.Delete(&model.Song{}, id).Error
}
