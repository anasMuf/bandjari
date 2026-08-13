package repository

import (
	"api/model"

	"gorm.io/gorm"
)

type SectionPartRepository interface {
	FindByID(id uint) (*model.SectionPart, error)
	FindByIDWithSlots(id uint) (*model.SectionPart, error)
	ListBySectionID(sectionID uint) ([]model.SectionPart, error)
	Save(part *model.SectionPart) error
}

type sectionPartRepository struct {
	db *gorm.DB
}

func NewSectionPartRepository(db *gorm.DB) SectionPartRepository {
	return &sectionPartRepository{db: db}
}

func (r *sectionPartRepository) FindByID(id uint) (*model.SectionPart, error) {
	var part model.SectionPart
	err := r.db.First(&part, id).Error
	return &part, err
}

func (r *sectionPartRepository) FindByIDWithSlots(id uint) (*model.SectionPart, error) {
	var part model.SectionPart
	err := r.db.Preload("SoundSlots.Sample", func(db *gorm.DB) *gorm.DB {
		return db.Order("order_index ASC")
	}).First(&part, id).Error
	return &part, err
}

func (r *sectionPartRepository) ListBySectionID(sectionID uint) ([]model.SectionPart, error) {
	var parts []model.SectionPart
	err := r.db.Preload("SoundSlots.Sample", func(db *gorm.DB) *gorm.DB {
		return db.Order("order_index ASC")
	}).Where("section_id = ?", sectionID).Order("id ASC").Find(&parts).Error
	return parts, err
}

func (r *sectionPartRepository) Save(part *model.SectionPart) error {
	return r.db.Save(part).Error
}
