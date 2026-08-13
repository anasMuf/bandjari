package utility

import (
	"fmt"
	"regexp"
	"strings"
)

// soundSlotKeyRe — key SoundSlot 1–2 karakter alfanumerik. Koma dilarang karena
// dipakai sebagai pemisah langkah pada format steps (mis. "T,D,KD").
var soundSlotKeyRe = regexp.MustCompile(`^[A-Za-z0-9]{1,2}$`)

// ValidateSoundSlotKey memeriksa format key SoundSlot (FR-SLOT-02): 1–2
// karakter alfanumerik (a-z, A-Z, 0-9), tanpa koma/spasi/tanda baca.
func ValidateSoundSlotKey(key string) error {
	if !soundSlotKeyRe.MatchString(key) {
		return fmt.Errorf("key harus 1–2 karakter alfanumerik (a-z, A-Z, 0-9) tanpa koma/spasi")
	}
	return nil
}

// ValidateSteps memeriksa bahwa setiap langkah dalam `steps` — dipisah koma —
// merujuk TEPAT ke salah satu `key` SoundSlot terdaftar pada SectionPart
// terkait (FR-SEQ-02). Mendukung key 1–2 karakter; himpunan key valid dinamis
// per SectionPart, sehingga tidak bisa berupa regex statis (TDD Bagian 7).
func ValidateSteps(steps string, keys []string) error {
	if steps == "" {
		return nil
	}
	valid := make(map[string]bool, len(keys))
	for _, k := range keys {
		valid[k] = true
	}
	for _, token := range strings.Split(steps, ",") {
		if token == "" {
			return fmt.Errorf("langkah kosong dalam steps tidak valid — tiap langkah harus satu key (mis. \"T,D\")")
		}
		if !valid[token] {
			return fmt.Errorf("key %q dalam steps tidak merujuk ke key SoundSlot manapun pada SectionPart ini", token)
		}
	}
	return nil
}
