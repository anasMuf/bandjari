package model

// Sample adalah file audio yang direferensikan SoundSlot (TDD Bagian 4.3).
// user_id NULL menandakan Sample Template System (is_system_template = true).
// ObjectKey adalah path di object storage — tidak diekspos ke JSON (akses via signed URL).
type Sample struct {
	BaseModel
	UserID           *uint  `gorm:"index:idx_sample_user_part" json:"user_id"`
	IsSystemTemplate bool   `gorm:"not null;default:false;index:idx_sample_template_part" json:"is_system_template"`
	Name             string `gorm:"not null;size:255" json:"name"`
	ObjectKey        string `gorm:"not null;size:512" json:"-"`
	FileSizeBytes    int    `gorm:"not null" json:"file_size_bytes"`
	Part             Part   `gorm:"not null;size:16;index:idx_sample_user_part;index:idx_sample_template_part" json:"part"`
}

func (Sample) TableName() string {
	return "samples"
}
