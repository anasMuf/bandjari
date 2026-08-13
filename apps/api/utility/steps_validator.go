package utility

import "fmt"

// ValidateSteps memeriksa bahwa setiap karakter dalam `steps` merujuk ke salah
// satu `key` SoundSlot yang terdaftar pada SectionPart terkait (FR-SEQ-02).
// Himpunan karakter valid bersifat dinamis per SectionPart, sehingga validasi
// tidak bisa berupa regex statis — lihat TDD Bagian 7.
func ValidateSteps(steps string, keys []string) error {
	valid := make(map[rune]bool, len(keys))
	for _, k := range keys {
		for _, r := range k {
			valid[r] = true
		}
	}
	for _, r := range steps {
		if !valid[r] {
			return fmt.Errorf("karakter %q dalam steps tidak merujuk ke key SoundSlot manapun pada SectionPart ini", string(r))
		}
	}
	return nil
}
