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
	err := r.db.Preload("Sections.Parts.SoundSlots").First(&song, id).Error
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

func (r *songRepository) Save(song *model.Song) error {
	return r.db.Save(song).Error
}

func (r *songRepository) Delete(id uint) error {
	return r.db.Delete(&model.Song{}, id).Error
}
