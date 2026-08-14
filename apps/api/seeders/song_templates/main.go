// Seeder Song Template System (FR-SONG-07) — sekali jalan, idempotent.
//
// Men-seed susunan asli "Standar Banjari" yang dikonfirmasi pemilik produk
// (song id 35): 8 section — awalan, dasar, naik setengah, naik, jeda, papatan,
// turun, tutup — lengkap dengan pola steps, jenis bunyi (SoundSlot), perilaku
// loop dan tujuan lanjut antar section (order/target/end).
//
// Jalankan dari apps/api:
//
//	go run ./seeders/song_templates
//
// Prasyarat: Sample Template System sudah di-seed
// (go run ./seeders/sample_templates) dan object storage aktif.
package main

import (
	"api/config"
	"api/model"
	"api/repository"
	"fmt"
	"log"
)

const templateSongName = "Standar Banjari (Template)"

// sampleNameByPartAndKey: key SoundSlot → nama Sample Template per Part.
// Pemetaan persis susunan song asli: rebana1=WEDOK, rebana2=LANANG,
// rebana3=GW, rebana4=GL, bass=DER/DUNG/DUK.
var sampleNameByPartAndKey = map[model.Part]map[string]string{
	model.PartRebana1: {"T": "WEDOK TEK", "DK": "WEDOK DUK", "DP": "WEDOK DEP"},
	model.PartRebana2: {"T": "LANANG TEK", "DK": "LANANG DUK", "DP": "LANANG DEP"},
	model.PartRebana3: {"T": "GW TEK", "D": "GW DUK"},
	model.PartRebana4: {"T": "GL TEK", "D": "GL DUK"},
	model.PartBass:    {"DR": "BASS DER", "DK": "BASS DUK", "DG": "BASS DUNG"},
}

type slotSpec struct {
	label string
	key   string
}

type partSpec struct {
	part  model.Part
	steps string
	slots []slotSpec
}

type sectionSpec struct {
	name        string
	loop        bool
	nextMode    string // "order" | "target" | "end"
	targetOrder int    // order_index tujuan saat nextMode="target" (-1 = tidak ada)
	parts       []partSpec
}

// Susunan 8 section asli "standar banjari". Loop & tujuan lanjut mengikuti data
// song asli: awalan → dasar; naik setengah & turun → dasar; naik & jeda →
// papatan; papatan & tutup = ending (berhenti).
var sectionSpecs = []sectionSpec{
	{
		name: "awalan", loop: false, nextMode: "order", targetOrder: -1,
		parts: []partSpec{
			{model.PartRebana1, "DK,.,.,.,T,.,.,.,DK,.,DK,.,T,.,.,T", []slotSpec{{"Tak", "T"}, {"Duk", "DK"}}},
			{model.PartRebana2, "DK,.,.,.,T,.,.,.,DK,.,DK,.,.,.,T,.", []slotSpec{{"Tak", "T"}, {"Duk", "DK"}}},
			{model.PartRebana3, "D,.,.,.,T,.,.,.,D,.,.,.,T,.,.,T", []slotSpec{{"Tak", "T"}, {"Dung", "D"}}},
			{model.PartRebana4, "D,.,.,.,T,.,.,.,D,.,.,.,.,.,.,T", []slotSpec{{"Tak", "T"}, {"Dung", "D"}}},
			{model.PartBass, "DR,.,.,.,.,.,.,DK,.,.,.,.,DK,.,DK,.", []slotSpec{{"Der", "DR"}, {"Duk", "DK"}, {"Dung", "DG"}}},
		},
	},
	{
		name: "dasar", loop: true, nextMode: "order", targetOrder: -1,
		parts: []partSpec{
			{model.PartRebana1, "DK,.,T,.,T,.,.,DP,DK,.,DK,.,T,.,.,T", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana2, "DK,.,.,T,T,.,DK,DP,.,DK,.,T,DP,.,T,.", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana3, "D,.,.,.,T,.,.,.,D,.,D,.,T,.,.,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartRebana4, "D,.,T,.,.,.,D,.,D,.,D,.,.,.,T,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartBass, "DR,.,.,.,.,.,.,DG,.,.,DG,.,DK,.,.,.", []slotSpec{{"Dung", "DG"}, {"Duk", "DK"}, {"Der", "DR"}}},
		},
	},
	{
		name: "naik setengah", loop: false, nextMode: "target", targetOrder: 1, // → dasar
		parts: []partSpec{
			{model.PartRebana1, "DK,.,T,.,T,.,.,T,T,.,T,.,T,.,.,T", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana2, "DK,.,T,.,.,.,T,.,T,.,.,T,.,DP,T,.", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana3, "D,.,.,.,T,.,.,.,T,.,.,.,T,.,.,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartRebana4, "D,.,.,.,T,.,T,.,T,.,.,.,T,.,T,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartBass, "DR,.,.,.,.,.,.,.,DK,.,.,.,DG,.,DK,.", []slotSpec{{"Dung", "DG"}, {"Duk", "DK"}, {"Der", "DR"}}},
		},
	},
	{
		name: "naik", loop: false, nextMode: "target", targetOrder: 5, // → papatan
		parts: []partSpec{
			{model.PartRebana1, "DK,.,DK,.,T,.,.,T,T,.,T,.,T,.,.,T,DK,.,DK,.,DK,.,.,DK,DK,.,DK,.,DK,.,.,DK", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana2, "DK,DK,.,T,T,.,T,.,T,.,.,T,.,DK,T,.,DK,.,.,DK,DK,.,DK,.,DK,.,.,DK,.,DK,DK,.", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana3, "D,.,.,.,T,.,.,.,T,.,.,.,T,.,.,.,D,.,.,.,D,.,.,.,D,.,.,.,D,.,.,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartRebana4, "D,.,D,.,T,.,.,.,T,.,T,.,T,.,.,.,D,.,D,.,D,.,.,.,D,.,D,.,D,.,.,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartBass, "DR,.,.,.,.,.,.,.,DK,.,.,.,DK,.,DK,.,DR,.,.,.,DK,.,DK,.,DR,.,.,.,DK,.,DK,.", []slotSpec{{"Dung", "DG"}, {"Duk", "DK"}, {"Der", "DR"}}},
		},
	},
	{
		name: "jeda", loop: false, nextMode: "target", targetOrder: 5, // → papatan
		parts: []partSpec{
			{model.PartRebana1, "DK,.,T,.,T,.,.,T,T,.,DK,.,T,DK,.,T,.,.,.,.,T,.,.,T,T,.,T,.,T,.,.,T,T,.,T,.,T,.,.,T,T,.,DK,.,T,.,.,T", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana2, "DK,.,.,T,T,.,T,T,.,DK,.,T,.,DK,T,.,DK,.,.,.,.,.,T,.,T,.,.,T,.,T,T,.,T,T,.,T,T,.,T,T,.,DK,.,T,T,.,T,.", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana3, "D,.,.,.,T,.,.,.,T,.,D,.,T,.,.,T,.,.,.,.,T,.,.,.,T,.,.,.,T,.,.,.,T,.,.,.,T,.,.,.,T,.,D,.,T,.,.,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartRebana4, "D,.,T,.,.,.,T,.,T,.,T,.,.,.,T,.,D,.,.,.,.,.,T,.,T,.,T,.,.,.,T,.,T,.,T,.,.,.,T,.,D,.,T,.,.,.,T,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartBass, "DR,.,.,.,.,.,.,DK,.,.,DK,.,DG,.,.,.,DR,.,.,.,.,.,.,.,DK,.,.,.,DG,.,DK,.,DR,.,.,.,.,.,.,DK,.,.,DK,.,DG,.,.,.", []slotSpec{{"Dung", "DG"}, {"Duk", "DK"}, {"Der", "DR"}}},
		},
	},
	{
		name: "papatan", loop: true, nextMode: "end", targetOrder: -1,
		parts: []partSpec{
			{model.PartRebana1, "DK,.,T,.,T,.,.,T,T,.,DK,.,T,.,.,T", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana2, "DK,.,.,T,T,.,T,T,.,DK,.,T,T,.,T,.", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana3, "D,.,.,.,T,.,.,.,T,.,D,.,T,.,.,T", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartRebana4, "D,.,T,.,.,.,T,.,T,.,T,.,.,.,T,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartBass, "DR,.,.,.,.,.,.,DK,.,.,DK,.,DG,.,.,.", []slotSpec{{"Dung", "DG"}, {"Duk", "DK"}, {"Der", "DR"}}},
		},
	},
	{
		name: "turun", loop: false, nextMode: "target", targetOrder: 1, // → dasar
		parts: []partSpec{
			{model.PartRebana1, "DK,.,DK,.,DK,.,.,T,T,.,DK,.,T,.,.,T", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana2, "DK,DK,.,DK,.,.,T,T,.,DK,.,T,T,.,T,.", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana3, "D,.,.,.,D,.,.,.,T,.,.,.,T,.,.,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartRebana4, "D,.,D,.,.,.,T,.,T,.,D,.,.,.,T,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartBass, "DR,.,.,.,.,.,.,.,DK,.,.,.,DK,.,DK,.", []slotSpec{{"Dung", "DG"}, {"Duk", "DK"}, {"Der", "DR"}}},
		},
	},
	{
		name: "tutup", loop: false, nextMode: "end", targetOrder: -1,
		parts: []partSpec{
			{model.PartRebana1, "DK,.,DK,.,DK,.,.,T,T,.,DK,.,T,.,.,T,DK,.,.,.,.,.,.,.", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana2, "DK,DK,.,DK,.,.,T,T,.,DK,.,T,T,.,T,.,DK,.,.,.,.,.,.,.", []slotSpec{{"Tek", "T"}, {"Duk", "DK"}, {"Dep", "DP"}}},
			{model.PartRebana3, "D,.,.,.,D,.,.,.,T,.,.,.,T,.,.,.,D,.,.,.,.,.,.,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartRebana4, "D,.,D,.,.,.,T,.,T,.,D,.,.,.,T,.,D,.,.,.,.,.,.,.", []slotSpec{{"Tek", "T"}, {"Duk", "D"}}},
			{model.PartBass, "DR,.,.,.,.,.,.,.,DK,.,.,.,DK,.,DK,.,DR,.,.,.,.,.,.,.", []slotSpec{{"Dung", "DG"}, {"Duk", "DK"}, {"Der", "DR"}}},
		},
	},
}

func main() {
	config.LoadEnv()
	db := config.DBInit()
	// DB baru mungkin belum punya tabel — samakan dengan AutoMigrate main app.
	if err := db.AutoMigrate(
		&model.User{},
		&model.Sample{},
		&model.Song{},
		&model.Section{},
		&model.SectionPart{},
		&model.SoundSlot{},
	); err != nil {
		log.Fatalf("migrate: %v", err)
	}
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

	song := &model.Song{
		UserID:           nil, // milik System
		IsSystemTemplate: true,
		Name:             templateSongName,
		Bpm:              90,
	}

	for i, spec := range sectionSpecs {
		sec := model.Section{
			Name:       spec.name,
			OrderIndex: i,
			Loop:       spec.loop,
			NextMode:   spec.nextMode,
		}
		for _, p := range spec.parts {
			steps := p.steps
			sp := model.SectionPart{Part: p.part, Steps: &steps}
			for _, s := range p.slots {
				slot := model.SoundSlot{Label: s.label, Key: s.key, OrderIndex: len(sp.SoundSlots)}
				if name, ok := sampleNameByPartAndKey[p.part][s.key]; ok {
					if template, err := sampleRepo.FindTemplateByNameAndPart(name, p.part); err == nil && template.ID != 0 {
						sampleID := template.ID
						slot.SampleID = &sampleID
					}
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

	// GORM melewatkan nilai zero (false) saat INSERT — pastikan loop=false
	// benar-benar tersimpan (kolom punya default true).
	loopFalse := 0
	for i, spec := range sectionSpecs {
		if spec.loop {
			continue
		}
		if err := db.Model(&model.Section{}).Where("id = ?", song.Sections[i].ID).Update("loop", false).Error; err != nil {
			log.Fatalf("set loop=false section %d: %v", i, err)
		}
		song.Sections[i].Loop = false
		loopFalse++
	}

	// Remap next_section_id untuk section mode "target" — ID section hasil
	// create baru diketahui setelah insert.
	targets := 0
	for i, spec := range sectionSpecs {
		if spec.nextMode != string(model.NextModeTarget) || spec.targetOrder < 0 {
			continue
		}
		targetID := song.Sections[spec.targetOrder].ID
		if err := songRepo.UpdateSectionNextTarget(song.Sections[i].ID, string(model.NextModeTarget), &targetID); err != nil {
			log.Fatalf("remap target section %d: %v", i, err)
		}
		song.Sections[i].NextSectionID = &targetID
		targets++
	}

	fmt.Printf("SEED: Song template \"%s\" — %d section, %d loop=false, %d target lanjut di-remap.\n",
		templateSongName, len(song.Sections), loopFalse, targets)
}
