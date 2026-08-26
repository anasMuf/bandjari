package model

// Visibility adalah status publikasi lagu: public tampil di Explore untuk
// semua orang (Guest maupun user lain), private hanya untuk pemiliknya.
type Visibility string

const (
	// VisibilityPublic — lagu tampil di Explore beserta nama author.
	VisibilityPublic Visibility = "public"
	// VisibilityPrivate (default) — hanya pemilik yang bisa melihat/membuka.
	VisibilityPrivate Visibility = "private"
)

// Song adalah satu unit lagu Al-Banjari (TDD Bagian 4.4).
// user_id NULL menandakan Song Template System (is_system_template = true).
type Song struct {
	BaseModel
	UserID           *uint `gorm:"index" json:"user_id"`
	IsSystemTemplate bool  `gorm:"not null;default:false;index" json:"is_system_template"`
	// Visibility default private — lagu tidak tampil di Explore sampai admin
	// pemiliknya memublikasikan (FR-VIS). Template selalu publik (via is_system_template).
	Visibility string `gorm:"not null;size:16;default:private;index" json:"visibility"`
	Name       string `gorm:"not null;size:255" json:"name"`
	Bpm        int16  `gorm:"not null" json:"bpm"`
	// Author — relasi opsional untuk nama pemilik lagu. json:"-" agar tidak
	// bocor ke respons JSON; hanya di-load via Preload saat dibutuhkan
	// (mis. daftar lagu publik di Explore).
	Author   *User     `gorm:"foreignKey:UserID;references:ID" json:"-"`
	Sections []Section `gorm:"foreignKey:SongID;constraint:OnDelete:CASCADE" json:"sections,omitempty"`
}

func (Song) TableName() string {
	return "songs"
}
