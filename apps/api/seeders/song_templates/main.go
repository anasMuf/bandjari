// Seeder Song Template System (FR-SONG-07) — sekali jalan, idempotent.
//
// Jalankan dari apps/api:
//
//	go run ./seeders/song_templates
//
// CATATAN: susunan `steps` di bawah adalah PLACEHOLDER — pemilik produk akan
// menyusun rumus asli (awalan/dasar/naik/turun/penutup) dan menggantinya di sini.
package main

import (
	"api/config"
	"api/model"
	"api/repository"
	"fmt"
	"log"
)

const templateSongName = "Sholawat Badar (Template)"

func main() {
	config.LoadEnv()
	db := config.DBInit()
	if err := config.EnsureConstraints(db); err != nil {
		log.Fatalf("constraint: %v", err)
	}

	songRepo := repository.NewSongRepository(db)
	sampleRepo := repository.NewSampleRepository(db)

	// Idempotensi: lewati bila template dengan nama ini sudah ada.
	var existing int64
	if err := db.Model(&model.Song{}).
		Where("is_system_template = true AND name = ?", templateSongName).
		Count(&existing).Error; err != nil {
		log.Fatalf("cek existing: %v", err)
	}
	if existing > 0 {
		fmt.Printf("SKIP: Song template \"%s\" sudah ada.\n", templateSongName)
		return
	}

	bpmNaik := int16(110)
	bpmPenutup := int16(80)

	// Placeholder section standar Al-Banjari + BPM override contoh.
	sectionSpecs := []struct {
		name        string
		bpmOverride *int16
	}{
		{"Awalan", nil},
		{"Dasar", nil},
		{"Naik", &bpmNaik},
		{"Turun", nil},
		{"Penutup", &bpmPenutup},
	}

	song := &model.Song{
		UserID:           nil, // milik System
		IsSystemTemplate: true,
		Name:             templateSongName,
		Bpm:              90,
	}

	for si, spec := range sectionSpecs {
		sec := model.Section{
			Name:        spec.name,
			OrderIndex:  si,
			BpmOverride: spec.bpmOverride,
		}
		for _, part := range model.AllParts {
			sp := model.SectionPart{Part: part}
			// Rumus placeholder: rebana 8 ketuk selang-seling, bass 4 ketuk dung.
			steps := "TDTDTDTD"
			if part == model.PartBass {
				steps = "DDDDDDDD"
			}
			sp.Steps = &steps

			for _, def := range []struct{ label, key string }{
				{"Tak", "T"},
				{"Dung", "D"},
			} {
				slot := model.SoundSlot{Label: def.label, Key: def.key, OrderIndex: len(sp.SoundSlots)}
				if template, err := sampleRepo.FindTemplateByPartAndLabel(part, def.label); err == nil && template.ID != 0 {
					sampleID := template.ID
					slot.SampleID = &sampleID
				}
				sp.SoundSlots = append(sp.SoundSlots, slot)
			}
			sec.Parts = append(sec.Parts, sp)
		}
		song.Sections = append(song.Sections, sec)
	}

	if err := songRepo.Create(song); err != nil {
		log.Fatalf("insert song template: %v", err)
	}
	fmt.Printf("SEED: Song template \"%s\" (5 section, 5 part, slot default terpasang Sample Template).\n", templateSongName)
}
