package dto

import "time"

type CreateSongRequest struct {
	Name string `json:"name" validate:"required,min=1,max=255"`
	Bpm  int16  `json:"bpm" validate:"required,min=20,max=400"`
}

type UpdateSongRequest struct {
	Name *string `json:"name" validate:"omitempty,min=1,max=255"`
	Bpm  *int16  `json:"bpm" validate:"omitempty,min=20,max=400"`
}

type SongResponse struct {
	ID               uint              `json:"id"`
	UserID           *uint             `json:"user_id"`
	IsSystemTemplate bool              `json:"is_system_template"`
	Name             string            `json:"name"`
	Bpm              int16             `json:"bpm"`
	SectionCount     int               `json:"section_count"`
	UpdatedAt        time.Time         `json:"updated_at"`
	Sections         []SectionResponse `json:"sections,omitempty"`
}
