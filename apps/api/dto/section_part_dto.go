package dto

import "api/model"

type UpdateStepsRequest struct {
	Steps *NullableString `json:"steps"`
}

type SectionPartResponse struct {
	ID         uint                `json:"id"`
	SectionID  uint                `json:"section_id"`
	Part       model.Part          `json:"part"`
	Steps      *string             `json:"steps"`
	SoundSlots []SoundSlotResponse `json:"sound_slots"`
}
