package dto

import (
	"encoding/json"
	"errors"
)

// NullableUint membedakan "tidak dikirim" (Set=false), "null" (Set=true, Value=nil),
// dan "nilai" (Set=true, Value=ptr) — untuk field yang boleh dikosongkan via update.
// Menerima angka langsung, null, atau bentuk objek klien ter-generate {set, value}.
type NullableUint struct {
	Set   bool
	Value *uint
}

func (n *NullableUint) UnmarshalJSON(data []byte) error {
	n.Set = true
	if string(data) == "null" {
		n.Value = nil
		return nil
	}
	var v uint
	if err := json.Unmarshal(data, &v); err == nil {
		n.Value = &v
		return nil
	}
	var obj struct {
		Set   bool  `json:"set"`
		Value *uint `json:"value"`
	}
	if err := json.Unmarshal(data, &obj); err == nil {
		n.Set = obj.Set
		n.Value = obj.Value
		return nil
	}
	return errors.New("field harus angka, null, atau objek {set, value}")
}

// NullableString sama seperti NullableUint, untuk string (mis. steps).
type NullableString struct {
	Set   bool
	Value *string
}

func (n *NullableString) UnmarshalJSON(data []byte) error {
	n.Set = true
	if string(data) == "null" {
		n.Value = nil
		return nil
	}
	var v string
	if err := json.Unmarshal(data, &v); err != nil {
		return errors.New("field harus string atau null")
	}
	n.Value = &v
	return nil
}
