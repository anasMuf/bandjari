package dto

import (
	"encoding/json"
	"errors"
)

// NullableInt16 membedakan tiga kondisi field `bpm_override` pada update:
// - tidak dikirim (Set=false) → tidak ada perubahan
// - dikirim null (Set=true, Value=nil) → kosongkan (ikuti BPM Song)
// - dikirim nilai (Set=true, Value=ptr) → set override
type NullableInt16 struct {
	Set   bool
	Value *int16
}

func (n *NullableInt16) UnmarshalJSON(data []byte) error {
	n.Set = true
	if string(data) == "null" {
		n.Value = nil
		return nil
	}

	// Bentuk 1: angka langsung (mis. dari curl)
	var v int16
	if err := json.Unmarshal(data, &v); err == nil {
		n.Value = &v
		return nil
	}

	// Bentuk 2: objek dari klien ter-generate Orval — {"set":true,"value":70}
	// value kosong (tidak dikirim) berarti "kosongkan override".
	var obj struct {
		Set   bool   `json:"set"`
		Value *int16 `json:"value"`
	}
	if err := json.Unmarshal(data, &obj); err == nil {
		n.Set = obj.Set
		n.Value = obj.Value
		return nil
	}
	return errors.New("bpm_override harus angka 20-400, null, atau objek {set, value}")
}

type CreateSectionRequest struct {
	Name string `json:"name" validate:"required,min=1,max=255"`
}

type UpdateSectionRequest struct {
	Name        *string        `json:"name" validate:"omitempty,min=1,max=255"`
	BpmOverride *NullableInt16 `json:"bpm_override"`
}

type ReorderSectionRequest struct {
	OrderIndex int `json:"order_index" validate:"min=0"`
}

type SectionResponse struct {
	ID          uint   `json:"id"`
	SongID      uint   `json:"song_id"`
	Name        string `json:"name"`
	OrderIndex  int    `json:"order_index"`
	BpmOverride *int16 `json:"bpm_override"`
}
