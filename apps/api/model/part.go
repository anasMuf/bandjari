package model

// Part merepresentasikan instrumen dalam formasi Al-Banjari murni (TDD Bagian 5).
// Bersifat tetap — 5 nilai, bukan tabel relasi (TDD AD-5).
type Part string

const (
	PartRebana1 Part = "rebana1"
	PartRebana2 Part = "rebana2"
	PartRebana3 Part = "rebana3"
	PartRebana4 Part = "rebana4"
	PartBass    Part = "bass"
)

var AllParts = []Part{PartRebana1, PartRebana2, PartRebana3, PartRebana4, PartBass}

// IsValidPart mengecek apakah nilai part termasuk salah satu dari 5 enum.
func IsValidPart(p Part) bool {
	for _, valid := range AllParts {
		if p == valid {
			return true
		}
	}
	return false
}
