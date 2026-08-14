package repository

import (
	"api/model"

	"gorm.io/gorm"
)

type SectionRepository interface {
	Create(section *model.Section) error
	FindByID(id uint) (*model.Section, error)
	FindByIDWithParts(id uint) (*model.Section, error)
	ListBySongID(songID uint) ([]model.Section, error)
	CountBySongID(songID uint) (int64, error)
	Save(section *model.Section) error
	UpdateOrderIndex(id uint, orderIndex int) error
	// UpdateLoop menimpa nilai loop — diperlukan karena GORM melewatkan nilai
	// zero (false) saat INSERT (kolom punya default true).
	UpdateLoop(id uint, loop bool) error
	// ClearNextTarget mereset section-section yang menjadikan targetID sebagai
	// tujuan lanjut (next_mode=target) kembali ke mode default (order).
	ClearNextTarget(targetID uint) error
	Delete(id uint) error
	WithTransaction(fn func(repo SectionRepository) error) error
}

type sectionRepository struct {
	db *gorm.DB
}

func NewSectionRepository(db *gorm.DB) SectionRepository {
	return &sectionRepository{db: db}
}

func (r *sectionRepository) Create(section *model.Section) error {
	return r.db.Create(section).Error
}

func (r *sectionRepository) FindByID(id uint) (*model.Section, error) {
	var section model.Section
	err := r.db.First(&section, id).Error
	return &section, err
}

func (r *sectionRepository) FindByIDWithParts(id uint) (*model.Section, error) {
	var section model.Section
	err := r.db.Preload("Parts.SoundSlots").First(&section, id).Error
	return &section, err
}

func (r *sectionRepository) ListBySongID(songID uint) ([]model.Section, error) {
	var sections []model.Section
	err := r.db.Where("song_id = ?", songID).Order("order_index ASC").Find(&sections).Error
	return sections, err
}

func (r *sectionRepository) CountBySongID(songID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.Section{}).Where("song_id = ?", songID).Count(&count).Error
	return count, err
}

func (r *sectionRepository) Save(section *model.Section) error {
	return r.db.Save(section).Error
}

func (r *sectionRepository) UpdateOrderIndex(id uint, orderIndex int) error {
	return r.db.Model(&model.Section{}).Where("id = ?", id).Update("order_index", orderIndex).Error
}

func (r *sectionRepository) ClearNextTarget(targetID uint) error {
	return r.db.Model(&model.Section{}).
		Where("next_section_id = ?", targetID).
		Updates(map[string]interface{}{"next_mode": "order", "next_section_id": nil}).Error
}

func (r *sectionRepository) UpdateLoop(id uint, loop bool) error {
	return r.db.Model(&model.Section{}).Where("id = ?", id).Update("loop", loop).Error
}

func (r *sectionRepository) Delete(id uint) error {
	return r.db.Delete(&model.Section{}, id).Error
}

func (r *sectionRepository) WithTransaction(fn func(repo SectionRepository) error) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		return fn(&sectionRepository{db: tx})
	})
}
