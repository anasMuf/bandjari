package model

// SoundSlot mendefinisikan satu jenis bunyi pukulan milik satu SectionPart
// (mis. "Tak"/T, "Dung"/D, "Duk"/K) — dinamis, jumlah bebas (TDD Bagian 4.6a).
type SoundSlot struct {
	BaseModel
	SectionPartID uint   `gorm:"not null" json:"section_part_id"`
	Label         string `gorm:"not null;size:64" json:"label"`
	// Key boleh 1–2 karakter (keputusan pemilik produk). Format steps mengikuti:
	// tiap langkah = satu key utuh yang dipisah koma (mis. "T,D,KD").
	// Keunikan key per SectionPart dikelola sebagai indeks unik PARSIAL hanya
	// untuk baris aktif (deleted_at IS NULL) di EnsureConstraints — lihat catatan
	// di config/database.go — agar key bekas slot terhapus bisa dipakai kembali.
	Key        string  `gorm:"not null;size:2" json:"key"`
	SampleID   *uint   `json:"sample_id"`
	Sample     *Sample `gorm:"foreignKey:SampleID;constraint:OnDelete:RESTRICT" json:"sample,omitempty"`
	OrderIndex int     `gorm:"not null;default:0" json:"order_index"`
}

func (SoundSlot) TableName() string {
	return "sound_slots"
}
