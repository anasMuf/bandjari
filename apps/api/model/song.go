package model

// Song adalah satu unit lagu Al-Banjari (TDD Bagian 4.4).
// user_id NULL menandakan Song Template System (is_system_template = true).
type Song struct {
	BaseModel
	UserID           *uint     `gorm:"index" json:"user_id"`
	IsSystemTemplate bool      `gorm:"not null;default:false;index" json:"is_system_template"`
	Name             string    `gorm:"not null;size:255" json:"name"`
	Bpm              int16     `gorm:"not null" json:"bpm"`
	Sections         []Section `gorm:"foreignKey:SongID;constraint:OnDelete:CASCADE" json:"sections,omitempty"`
}

func (Song) TableName() string {
	return "songs"
}
