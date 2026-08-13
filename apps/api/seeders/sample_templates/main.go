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

// Pemetaan file → part. REBANA1=LANANG, REBANA2=WEDOK, REBANA3=GL, REBANA4=GW —
// placeholder yang dapat disesuaikan dengan karakter asli tiap grup.
// Nama mengandung "Tak"/"Dung" agar auto-attach SoundSlot default (FR-SLOT-09)
// menemukannya via pencocokan part+label.
var sampleEntries = []seedEntry{
	{"LANANG TEK.wav", "Rebana1 Tak", model.PartRebana1},
	{"LANANG DUK.wav", "Rebana1 Duk", model.PartRebana1},
	{"LANANG DEP.wav", "Rebana1 Dep", model.PartRebana1},
	{"WEDOK TEK.wav", "Rebana2 Tak", model.PartRebana2},
	{"WEDOK DUK.wav", "Rebana2 Duk", model.PartRebana2},
	{"WEDOK DEP.wav", "Rebana2 Dep", model.PartRebana2},
	{"GL TEK.wav", "Rebana3 Tak", model.PartRebana3},
	{"GL DUK.wav", "Rebana3 Duk", model.PartRebana3},
	{"GW TEK.wav", "Rebana4 Tak", model.PartRebana4},
	{"GW DUK.wav", "Rebana4 Duk", model.PartRebana4},
	{"BASS DER.wav", "Bass Tak", model.PartBass},
	{"BASS DUNG.wav", "Bass Dung", model.PartBass},
	{"BASS DUK.wav", "Bass Duk", model.PartBass},
}

func main() {
	srcDir := flag.String("src", "../../docs/src/SAMPLING HADRAH AB CHANNEL", "direktori file .wav sumber")
	flag.Parse()

	config.LoadEnv()
	db := config.DBInit()
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
