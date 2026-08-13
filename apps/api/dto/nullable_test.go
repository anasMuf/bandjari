package dto

import (
	"encoding/json"
	"testing"
)

func dtoStrPtr(s string) *string { return &s }

func TestNullableString_Unmarshal(t *testing.T) {
	tests := []struct {
		name    string
		json    string
		wantSet bool
		wantVal *string
		wantErr bool
	}{
		{"string langsung", `"TDTD"`, true, dtoStrPtr("TDTD"), false},
		{"null", `null`, true, nil, false},
		{"objek set+value (Orval)", `{"set":true,"value":"TD"}`, true, dtoStrPtr("TD"), false},
		{"objek set tanpa value", `{"set":true}`, true, nil, false},
		{"angka ditolak", `42`, false, nil, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var n NullableString
			err := json.Unmarshal([]byte(tt.json), &n)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr = %v", err, tt.wantErr)
			}
			if err != nil {
				return
			}
			if n.Set != tt.wantSet {
				t.Fatalf("Set = %v, want %v", n.Set, tt.wantSet)
			}
			if (n.Value == nil) != (tt.wantVal == nil) {
				t.Fatalf("Value = %v, want %v", n.Value, tt.wantVal)
			}
			if n.Value != nil && tt.wantVal != nil && *n.Value != *tt.wantVal {
				t.Fatalf("Value = %q, want %q", *n.Value, *tt.wantVal)
			}
		})
	}
}

func TestNullableUint_Unmarshal(t *testing.T) {
	tests := []struct {
		name    string
		json    string
		wantSet bool
		wantNil bool
		wantVal uint
		wantErr bool
	}{
		{"angka langsung", `7`, true, false, 7, false},
		{"null", `null`, true, true, 0, false},
		{"objek set+value (Orval)", `{"set":true,"value":9}`, true, false, 9, false},
		{"objek set tanpa value", `{"set":true}`, true, true, 0, false},
		{"string ditolak", `"x"`, false, false, 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var n NullableUint
			err := json.Unmarshal([]byte(tt.json), &n)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr = %v", err, tt.wantErr)
			}
			if err != nil {
				return
			}
			if n.Set != tt.wantSet {
				t.Fatalf("Set = %v, want %v", n.Set, tt.wantSet)
			}
			if (n.Value == nil) != tt.wantNil {
				t.Fatalf("Value nil-ness = %v, want %v", n.Value == nil, tt.wantNil)
			}
			if n.Value != nil && *n.Value != tt.wantVal {
				t.Fatalf("Value = %d, want %d", *n.Value, tt.wantVal)
			}
		})
	}
}
