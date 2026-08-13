package model

// SoundSlot mendefinisikan satu jenis bunyi pukulan milik satu SectionPart
// (mis. "Tak"/T, "Dung"/D, "Duk"/K) — dinamis, jumlah bebas (TDD Bagian 4.6a).
type SoundSlot struct {
	BaseModel
	SectionPartID uint    `gorm:"not null;uniqueIndex:idx_slot_key" json:"section_part_id"`
	Label         string  `gorm:"not null;size:64" json:"label"`
	Key           string  `gorm:"not null;size:1;uniqueIndex:idx_slot_key" json:"key"`
	SampleID      *uint   `json:"sample_id"`
	Sample        *Sample `gorm:"foreignKey:SampleID;constraint:OnDelete:RESTRICT" json:"sample,omitempty"`
	OrderIndex    int     `gorm:"not null;default:0" json:"order_index"`
}

func (SoundSlot) TableName() string {
	return "sound_slots"
}
