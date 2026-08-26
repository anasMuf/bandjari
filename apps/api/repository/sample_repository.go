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
	CountSoundSlotsBySampleIDs(sampleIDs []uint) (map[uint]int64, error)
	// IsReferencedByPublicSong true bila sample dipakai oleh ≥1 lagu yang
	// terlihat publik (visibility='public' atau template) — dasar izin Guest
	// memutar audio lagu publik (FR-VIS).
	IsReferencedByPublicSong(sampleID uint) (bool, error)
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

// CountSoundSlotsBySampleIDs menghitung jumlah SoundSlot aktif yang memakai
// tiap sample dalam satu query — dipakai meta "Dipakai di N SoundSlot" (RD-5).
func (r *sampleRepository) CountSoundSlotsBySampleIDs(sampleIDs []uint) (map[uint]int64, error) {
	result := make(map[uint]int64, len(sampleIDs))
	if len(sampleIDs) == 0 {
		return result, nil
	}
	type row struct {
		SampleID uint
		Count    int64
	}
	var rows []row
	err := r.db.Model(&model.SoundSlot{}).
		Select("sound_slots.sample_id, COUNT(*) AS count").
		Joins("JOIN section_parts ON section_parts.id = sound_slots.section_part_id").
		Where("sound_slots.sample_id IN ? AND section_parts.deleted_at IS NULL", sampleIDs).
		Group("sound_slots.sample_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.SampleID] = r.Count
	}
	return result, nil
}

func (r *sampleRepository) Save(sample *model.Sample) error {
	return r.db.Save(sample).Error
}

// IsReferencedByPublicSong mengecek apakah sample direferensikan SoundSlot dari
// lagu yang terlihat publik. Relasi: sound_slots → section_parts → sections →
// songs. `deleted_at IS NULL` manual untuk tabel join (GORM hanya mengotomatiskan
// filter soft-delete pada tabel utama).
func (r *sampleRepository) IsReferencedByPublicSong(sampleID uint) (bool, error) {
	var count int64
	err := r.db.Model(&model.SoundSlot{}).
		Joins("JOIN section_parts ON section_parts.id = sound_slots.section_part_id"+
			" AND section_parts.deleted_at IS NULL").
		Joins("JOIN sections ON sections.id = section_parts.section_id"+
			" AND sections.deleted_at IS NULL").
		Joins("JOIN songs ON songs.id = sections.song_id"+
			" AND songs.deleted_at IS NULL").
		Where("sound_slots.sample_id = ?", sampleID).
		Where("songs.is_system_template = ? OR songs.visibility = ?", true, model.VisibilityPublic).
		Count(&count).Error
	return count > 0, err
}

func (r *sampleRepository) Delete(id uint) error {
	return r.db.Delete(&model.Sample{}, id).Error
}
