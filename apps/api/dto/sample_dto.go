package dto

import "api/model"

type SampleResponse struct {
	ID               uint       `json:"id"`
	UserID           *uint      `json:"user_id"`
	IsSystemTemplate bool       `json:"is_system_template"`
	Name             string     `json:"name"`
	FileSizeBytes    int        `json:"file_size_bytes"`
	Part             model.Part `json:"part"`
	// UsageCount = jumlah SoundSlot aktif yang mereferensikan sample ini (FR-SAMP-04).
	UsageCount int64 `json:"usage_count"`
}

// SampleRefResponse adalah ringkasan Sample untuk disematkan di respons lain
// (mis. SoundSlot) — tanpa metadata berat seperti ukuran file.
type SampleRefResponse struct {
	ID               uint   `json:"id"`
	Name             string `json:"name"`
	IsSystemTemplate bool   `json:"is_system_template"`
}

type RenameSampleRequest struct {
	Name string `json:"name" validate:"required,min=1,max=255"`
}

type PlaybackURLResponse struct {
	URL string `json:"url"`
}
