package dto

type CreateSoundSlotRequest struct {
	Label    string `json:"label" validate:"required,min=1,max=64"`
	Key      string `json:"key" validate:"required,min=1,max=2"`
	SampleID *uint  `json:"sample_id"`
}

type UpdateSoundSlotRequest struct {
	Label    *string       `json:"label" validate:"omitempty,min=1,max=64"`
	Key      *string       `json:"key" validate:"omitempty,min=1,max=2"`
	SampleID *NullableUint `json:"sample_id"`
}

type SoundSlotResponse struct {
	ID            uint               `json:"id"`
	SectionPartID uint               `json:"section_part_id"`
	Label         string             `json:"label"`
	Key           string             `json:"key"`
	SampleID      *uint              `json:"sample_id"`
	Sample        *SampleRefResponse `json:"sample,omitempty"`
	OrderIndex    int                `json:"order_index"`
}
