package model

// SectionPart adalah wadah pukulan satu kombinasi Section × Part.
// Satu Section selalu punya tepat 5 SectionPart (TDD Bagian 4.6).
type SectionPart struct {
	BaseModel
	SectionID  uint        `gorm:"not null;uniqueIndex:idx_section_part" json:"section_id"`
	Part       Part        `gorm:"not null;size:16;uniqueIndex:idx_section_part" json:"part"`
	Steps      *string     `gorm:"type:text" json:"steps"`
	SoundSlots []SoundSlot `gorm:"foreignKey:SectionPartID;constraint:OnDelete:CASCADE" json:"sound_slots,omitempty"`
}

func (SectionPart) TableName() string {
	return "section_parts"
}
