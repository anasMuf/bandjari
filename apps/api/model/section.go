package model

// Mode tujuan setelah Section "sekali" (loop=false) selesai dimainkan.
type NextMode string

const (
	// NextModeOrder (default): lanjut ke section berikutnya dalam urutan.
	NextModeOrder NextMode = "order"
	// NextModeTarget: lanjut langsung ke NextSectionID.
	NextModeTarget NextMode = "target"
	// NextModeEnd: Ending — berhenti setelah section selesai (penutup).
	NextModeEnd NextMode = "end"
)

// Section adalah bagian dari sebuah Song (mis. "Awalan", "Naik") — dinamis,
// nama & jumlah bebas (TDD Bagian 4.5). BpmOverride nil berarti mengikuti BPM Song.
type Section struct {
	BaseModel
	SongID      uint   `gorm:"not null;index:idx_section_song_order" json:"song_id"`
	Name        string `gorm:"not null;size:255" json:"name"`
	OrderIndex  int    `gorm:"not null;index:idx_section_song_order" json:"order_index"`
	BpmOverride *int16 `json:"bpm_override"`
	// Loop=true (default) → section diulang terus saat dimainkan.
	// Loop=false → dimainkan SEKALI, lalu lanjut sesuai NextMode.
	Loop bool `gorm:"not null;default:true" json:"loop"`
	// NextMode menentukan tujuan setelah section "sekali" selesai:
	// order (default), target (ke NextSectionID), atau end (berhenti/penutup).
	NextMode string `gorm:"not null;size:16;default:order" json:"next_mode"`
	// NextSectionID = tujuan saat NextMode=target; nil selain itu.
	NextSectionID *uint         `json:"next_section_id"`
	NextSection   *Section      `gorm:"foreignKey:NextSectionID;constraint:OnDelete:SET NULL" json:"-"`
	Parts         []SectionPart `gorm:"foreignKey:SectionID;constraint:OnDelete:CASCADE" json:"parts,omitempty"`
}

func (Section) TableName() string {
	return "sections"
}
