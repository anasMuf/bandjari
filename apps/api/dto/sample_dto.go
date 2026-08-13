package dto

import "api/model"

type SampleResponse struct {
	ID               uint       `json:"id"`
	UserID           *uint      `json:"user_id"`
	IsSystemTemplate bool       `json:"is_system_template"`
	Name             string     `json:"name"`
	FileSizeBytes    int        `json:"file_size_bytes"`
	Part             model.Part `json:"part"`
}

type RenameSampleRequest struct {
	Name string `json:"name" validate:"required,min=1,max=255"`
}

type PlaybackURLResponse struct {
	URL string `json:"url"`
}
