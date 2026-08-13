package repository

import (
	"api/model"

	"gorm.io/gorm"
)

type SoundSlotRepository interface {
	Create(slot *model.SoundSlot) error
	FindByID(id uint) (*model.SoundSlot, error)
	ListBySectionPartID(partID uint) ([]model.SoundSlot, error)
	CountByKey(sectionPartID uint, key string) (int64, error)
	CountByKeyExcluding(sectionPartID uint, key string, excludeID uint) (int64, error)
	MaxOrderIndex(sectionPartID uint) (int, error)
	Save(slot *model.SoundSlot) error
	Delete(id uint) error
}

type soundSlotRepository struct {
	db *gorm.DB
}

func NewSoundSlotRepository(db *gorm.DB) SoundSlotRepository {
	return &soundSlotRepository{db: db}
}

func (r *soundSlotRepository) Create(slot *model.SoundSlot) error {
	return r.db.Create(slot).Error
}

func (r *soundSlotRepository) FindByID(id uint) (*model.SoundSlot, error) {
	var slot model.SoundSlot
	err := r.db.First(&slot, id).Error
	return &slot, err
}

func (r *soundSlotRepository) ListBySectionPartID(partID uint) ([]model.SoundSlot, error) {
	var slots []model.SoundSlot
	err := r.db.Where("section_part_id = ?", partID).Order("order_index ASC").Find(&slots).Error
	return slots, err
}

func (r *soundSlotRepository) CountByKey(sectionPartID uint, key string) (int64, error) {
	var count int64
	err := r.db.Model(&model.SoundSlot{}).
		Where("section_part_id = ? AND key = ?", sectionPartID, key).
		Count(&count).Error
	return count, err
}

func (r *soundSlotRepository) CountByKeyExcluding(sectionPartID uint, key string, excludeID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.SoundSlot{}).
		Where("section_part_id = ? AND key = ? AND id <> ?", sectionPartID, key, excludeID).
		Count(&count).Error
	return count, err
}

func (r *soundSlotRepository) MaxOrderIndex(sectionPartID uint) (int, error) {
	var max int
	err := r.db.Model(&model.SoundSlot{}).
		Where("section_part_id = ?", sectionPartID).
		Select("COALESCE(MAX(order_index), -1)").
		Scan(&max).Error
	return max, err
}

func (r *soundSlotRepository) Save(slot *model.SoundSlot) error {
	return r.db.Save(slot).Error
}

func (r *soundSlotRepository) Delete(id uint) error {
	return r.db.Delete(&model.SoundSlot{}, id).Error
}
