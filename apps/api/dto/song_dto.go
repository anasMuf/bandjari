package dto

import "time"

type CreateSongRequest struct {
	Name string `json:"name" validate:"required,min=1,max=255"`
	Bpm  int16  `json:"bpm" validate:"required,min=20,max=400"`
	// IsSystemTemplate opsional: true = buat sebagai Song Template System.
	// Hanya boleh dipakai admin (FR-ROLE).
	IsSystemTemplate *bool `json:"is_system_template"`
	// Visibility opsional (FR-VIS): "public" hanya boleh dipakai admin;
	// default "private" — lagu tidak tampil di Explore sampai dipublikasikan.
	Visibility *string `json:"visibility" validate:"omitempty,oneof=public private"`
}

type UpdateSongRequest struct {
	Name *string `json:"name" validate:"omitempty,min=1,max=255"`
	Bpm  *int16  `json:"bpm" validate:"omitempty,min=20,max=400"`
}

// UpdateSongVisibilityRequest dipakai endpoint PUT /songs/:id/visibility —
// hanya admin pemilik lagu yang boleh mengubah status (FR-VIS).
type UpdateSongVisibilityRequest struct {
	Visibility string `json:"visibility" validate:"required,oneof=public private"`
}

type SongResponse struct {
	ID               uint   `json:"id"`
	UserID           *uint  `json:"user_id"`
	IsSystemTemplate bool   `json:"is_system_template"`
	Visibility       string `json:"visibility"`
	Name             string `json:"name"`
	Bpm              int16  `json:"bpm"`
	// AuthorName nama pemilik lagu — hanya terisi saat relasi Author di-load
	// (daftar lagu publik); template tidak punya pemilik.
	AuthorName   string            `json:"author_name,omitempty"`
	SectionCount int               `json:"section_count"`
	UpdatedAt    time.Time         `json:"updated_at"`
	Sections     []SectionResponse `json:"sections,omitempty"`
}
