package utility

import "testing"

func TestValidateSteps(t *testing.T) {
	tests := []struct {
		name    string
		steps   string
		keys    []string
		wantErr bool
	}{
		{"valid", "T,D,T,D", []string{"T", "D"}, false},
		{"valid with third key", "T,D,K,D,T", []string{"T", "D", "K"}, false},
		{"valid key 2 karakter", "T,KD,T", []string{"T", "KD"}, false},
		{"valid langkah istirahat", "T,.,D,.,T", []string{"T", "D"}, false},
		{"invalid unknown key", "T,X,T,D", []string{"T", "D"}, true},
		{"invalid key parsial 2 karakter", "K,KD", []string{"KD"}, true}, // "K" bukan "KD"
		{"invalid langkah kosong", "T,,D", []string{"T", "D"}, true},
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

func TestValidateSoundSlotKey(t *testing.T) {
	tests := []struct {
		key     string
		wantErr bool
	}{
		{"T", false},
		{"D", false},
		{"KD", false},
		{"T1", false},
		{"", true},
		{"ABC", true}, // 3 karakter
		{"T,", true},  // koma = pemisah steps
		{",T", true},
		{"T D", true}, // spasi
		{"T-D", true}, // tanda baca
	}
	for _, tt := range tests {
		t.Run(tt.key, func(t *testing.T) {
			err := ValidateSoundSlotKey(tt.key)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateSoundSlotKey(%q) err = %v, wantErr = %v", tt.key, err, tt.wantErr)
			}
		})
	}
}
