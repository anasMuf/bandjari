package model

// Section adalah bagian dari sebuah Song (mis. "Awalan", "Naik") — dinamis,
// nama & jumlah bebas (TDD Bagian 4.5). BpmOverride nil berarti mengikuti BPM Song.
type Section struct {
	BaseModel
	SongID      uint          `gorm:"not null;index:idx_section_song_order" json:"song_id"`
	Name        string        `gorm:"not null;size:255" json:"name"`
	OrderIndex  int           `gorm:"not null;index:idx_section_song_order" json:"order_index"`
	BpmOverride *int16        `json:"bpm_override"`
	Parts       []SectionPart `gorm:"foreignKey:SectionID;constraint:OnDelete:CASCADE" json:"parts,omitempty"`
}

func (Section) TableName() string {
	return "sections"
}
