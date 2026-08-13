package repository

import (
	"api/model"
	"strings"

	"gorm.io/gorm"
)

type SampleRepository interface {
	Create(sample *model.Sample) error
	FindByID(id uint) (*model.Sample, error)
	ListByUserID(userID uint, part *model.Part) ([]model.Sample, error)
	ListTemplates(part *model.Part) ([]model.Sample, error)
	FindTemplateByNameAndPart(name string, part model.Part) (*model.Sample, error)
	FindTemplateByPartAndLabel(part model.Part, label string) (*model.Sample, error)
	CountReferencedBySoundSlots(sampleID uint) (int64, error)
	Save(sample *model.Sample) error
	Delete(id uint) error
}

type sampleRepository struct {
	db *gorm.DB
}

func NewSampleRepository(db *gorm.DB) SampleRepository {
	return &sampleRepository{db: db}
}

func (r *sampleRepository) Create(sample *model.Sample) error {
	return r.db.Create(sample).Error
}

func (r *sampleRepository) FindByID(id uint) (*model.Sample, error) {
	var sample model.Sample
	err := r.db.First(&sample, id).Error
	return &sample, err
}

func (r *sampleRepository) ListByUserID(userID uint, part *model.Part) ([]model.Sample, error) {
	q := r.db.Where("user_id = ? AND is_system_template = false", userID)
	if part != nil {
		q = q.Where("part = ?", *part)
	}
	var samples []model.Sample
	err := q.Order("created_at DESC").Find(&samples).Error
	return samples, err
}

// FindTemplateByPartAndLabel mencari Sample Template System yang cocok dengan
// part dan label bunyi (mis. "Tak"/"Dung") — dipakai saat auto-isi SoundSlot
// default (FR-SLOT-09, FR-SAMP-11).
func (r *sampleRepository) FindTemplateByPartAndLabel(part model.Part, label string) (*model.Sample, error) {
	var sample model.Sample
	err := r.db.Where("is_system_template = true AND part = ? AND LOWER(name) LIKE ?",
		part, "%"+strings.ToLower(label)+"%").First(&sample).Error
	return &sample, err
}

// ListTemplates mengembalikan Sample Template System (opsional filter part) — FR-SAMP-11/14.
func (r *sampleRepository) ListTemplates(part *model.Part) ([]model.Sample, error) {
	q := r.db.Where("is_system_template = true")
	if part != nil {
		q = q.Where("part = ?", *part)
	}
	var samples []model.Sample
	err := q.Order("part ASC, name ASC").Find(&samples).Error
	return samples, err
}

// FindTemplateByNameAndPart dipakai seeder untuk idempotensi.
func (r *sampleRepository) FindTemplateByNameAndPart(name string, part model.Part) (*model.Sample, error) {
	var sample model.Sample
	err := r.db.Where("is_system_template = true AND name = ? AND part = ?", name, part).First(&sample).Error
	return &sample, err
}

func (r *sampleRepository) CountReferencedBySoundSlots(sampleID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.SoundSlot{}).
		Joins("JOIN section_parts ON section_parts.id = sound_slots.section_part_id").
		Where("sound_slots.sample_id = ? AND section_parts.deleted_at IS NULL", sampleID).
		Count(&count).Error
	return count, err
}

func (r *sampleRepository) Save(sample *model.Sample) error {
	return r.db.Save(sample).Error
}

func (r *sampleRepository) Delete(id uint) error {
	return r.db.Delete(&model.Sample{}, id).Error
}
