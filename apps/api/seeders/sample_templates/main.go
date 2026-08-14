// Seeder Sample Template System (FR-SAMP-11) — sekali jalan, idempotent.
//
// Jalankan dari apps/api:
//
//	go run ./seeders/sample_templates -src "../../docs/src/SAMPLING HADRAH AB CHANNEL"
//
// Memerlukan object storage aktif (docker compose up -d minio).
package main

import (
	"api/config"
	"api/model"
	"api/repository"
	"api/service"
	"api/utility"
	"bytes"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

type seedEntry struct {
	file string
	name string
	part model.Part
}

// Pemetaan file → part — susunan asli pemilik produk untuk Song Template
// "Standar Banjari" (song id 35): REBANA1=WEDOK, REBANA2=LANANG,
// REBANA3=GW (GOLONG WEDOK), REBANA4=GL (GOLONG LANANG), BASS=DER/DUNG/DUK.
// Nama sample sama persis dengan label yang dipakai di SoundSlot song template
// agar seeder song menemukannya via pencocokan nama+part.
var sampleEntries = []seedEntry{
	{"WEDOK TEK.wav", "WEDOK TEK", model.PartRebana1},
	{"WEDOK DUK.wav", "WEDOK DUK", model.PartRebana1},
	{"WEDOK DEP.wav", "WEDOK DEP", model.PartRebana1},
	{"LANANG TEK.wav", "LANANG TEK", model.PartRebana2},
	{"LANANG DUK.wav", "LANANG DUK", model.PartRebana2},
	{"LANANG DEP.wav", "LANANG DEP", model.PartRebana2},
	{"GW TEK.wav", "GW TEK", model.PartRebana3},
	{"GW DUK.wav", "GW DUK", model.PartRebana3},
	{"GL TEK.wav", "GL TEK", model.PartRebana4},
	{"GL DUK.wav", "GL DUK", model.PartRebana4},
	{"BASS DER.wav", "BASS DER", model.PartBass},
	{"BASS DUNG.wav", "BASS DUNG", model.PartBass},
	{"BASS DUK.wav", "BASS DUK", model.PartBass},
}

func main() {
	srcDir := flag.String("src", "../../docs/src/SAMPLING HADRAH AB CHANNEL", "direktori file .wav sumber")
	flag.Parse()

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
	storage, err := service.NewStorageService(config.LoadStorageConfig())
	if err != nil {
		log.Fatalf("storage: %v — jalankan `docker compose up -d minio`", err)
	}
	repo := repository.NewSampleRepository(db)
	ctx := context.Background()

	seeded, skipped := 0, 0
	for _, e := range sampleEntries {
		if _, err := repo.FindTemplateByNameAndPart(e.name, e.part); err == nil {
			fmt.Printf("SKIP  %-16s [%s] sudah ada\n", e.name, e.part)
			skipped++
			continue
		}
		path := filepath.Join(*srcDir, e.file)
		data, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("gagal baca %s: %v", path, err)
		}
		if err := utility.ValidateWavAudio(data); err != nil {
			log.Fatalf("%s: %v", path, err)
		}
		key := fmt.Sprintf("samples/system/%s.wav", uuid.NewString())
		if err := storage.Upload(ctx, key, bytes.NewReader(data), int64(len(data)), "audio/wav"); err != nil {
			log.Fatalf("upload %s: %v", path, err)
		}
		sample := &model.Sample{
			UserID:           nil, // milik System, bukan User manapun
			IsSystemTemplate: true,
			Name:             e.name,
			ObjectKey:        key,
			FileSizeBytes:    len(data),
			Part:             e.part,
		}
		if err := repo.Create(sample); err != nil {
			log.Fatalf("insert %s: %v", e.name, err)
		}
		fmt.Printf("SEED  %-16s [%s] %d bytes\n", e.name, e.part, len(data))
		seeded++
	}
	fmt.Printf("\nSelesai: %d di-seed, %d dilewati.\n", seeded, skipped)
}
