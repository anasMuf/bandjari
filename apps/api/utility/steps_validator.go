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

// restStep adalah token langkah istirahat (senyap) dalam format steps. Tanda
// ini tidak bisa menjadi key karena key dibatasi alfanumerik 1–2 karakter.
const restStep = "."

// ValidateSteps memeriksa bahwa setiap langkah dalam `steps` — dipisah koma —
// merujuk ke satu atau lebih `key` SoundSlot terdaftar pada SectionPart
// terkait (FR-SEQ-02), atau merupakan langkah istirahat ".". Satu kolom boleh
// memuat beberapa bunyi sekaligus dengan pemisah "+" (mis. "T+D") — ini
// memungkinkan dua baris grid aktif di kolom yang sama. Mendukung key 1–2
// karakter; himpunan key valid dinamis per SectionPart (TDD Bagian 7).
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
			return fmt.Errorf("langkah kosong dalam steps tidak valid — tiap langkah harus key/istirahat (mis. \"T,D\")")
		}
		if token == restStep {
			continue // langkah istirahat — senyap, tidak butuh sample (AC-5)
		}
		for _, sub := range strings.Split(token, "+") {
			if sub == "" {
				return fmt.Errorf("sub-key kosong dalam langkah %q tidak valid", token)
			}
			if !valid[sub] {
				return fmt.Errorf("key %q dalam steps tidak merujuk ke key SoundSlot manapun pada SectionPart ini", sub)
			}
		}
	}
	return nil
}
