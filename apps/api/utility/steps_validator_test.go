package utility

import "testing"

func TestValidateSteps(t *testing.T) {
	tests := []struct {
		name    string
		steps   string
		keys    []string
		wantErr bool
	}{
		{"valid", "TDTD", []string{"T", "D"}, false},
		{"valid with third key", "TDKDT", []string{"T", "D", "K"}, false},
		{"invalid char", "TXTD", []string{"T", "D"}, true},
		{"empty steps", "", []string{"T", "D"}, false},
		{"empty keys with empty steps", "", nil, false},
		{"empty keys with steps", "T", nil, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSteps(tt.steps, tt.keys)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateSteps(%q, %v) err = %v, wantErr = %v", tt.steps, tt.keys, err, tt.wantErr)
			}
		})
	}
}
