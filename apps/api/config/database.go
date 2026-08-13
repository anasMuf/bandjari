package config

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func LoadEnv() {
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("No .env file found at root, pakai environment bawaan OS")
	}
}

func DBInit() *gorm.DB {
	user := os.Getenv("DB_USER")
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	name := os.Getenv("DB_NAME")
	sslmode := os.Getenv("SSL_MODE")

	dsn := fmt.Sprintf(
		"host=%s user=%s dbname=%s port=%s sslmode=%s",
		host, user, name, port, sslmode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Gagal koneksi ke database:", err)
	}

	var dbName string
	db.Raw("SELECT current_database()").Scan(&dbName)
	fmt.Println("PostgreSQL benar-benar connect ke:", dbName)

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("Error mengambil database object:", err)
	}
	err = sqlDB.Ping()
	if err != nil {
		log.Fatal("Tidak bisa mengakses database:", err)
	}
	log.Println("Berhasil koneksi ke database PostgreSQL via GORM")

	return db
}

// EnsureConstraints memasang CHECK constraint yang tidak bisa diekspresikan
// lewat tag GORM (TDD Bagian 4). Idempotent — aman dijalankan tiap startup.
func EnsureConstraints(db *gorm.DB) error {
	stmts := []string{
		// songs: BPM sanity check (TDD 4.4)
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_songs_bpm') THEN
				ALTER TABLE songs ADD CONSTRAINT chk_songs_bpm CHECK (bpm BETWEEN 20 AND 400);
			END IF;
		END $$;`,
		// songs: user_id NULL jhj is_system_template (TDD 4.4)
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_songs_template_owner') THEN
				ALTER TABLE songs ADD CONSTRAINT chk_songs_template_owner CHECK ((user_id IS NULL) = (is_system_template));
			END IF;
		END $$;`,
		// sections: bpm_override opsional, jika diisi 20–400 (TDD 4.5)
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sections_bpm_override') THEN
				ALTER TABLE sections ADD CONSTRAINT chk_sections_bpm_override CHECK (bpm_override IS NULL OR (bpm_override BETWEEN 20 AND 400));
			END IF;
		END $$;`,
		// samples: part enum (TDD 4.3)
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_samples_part') THEN
				ALTER TABLE samples ADD CONSTRAINT chk_samples_part CHECK (part IN ('rebana1','rebana2','rebana3','rebana4','bass'));
			END IF;
		END $$;`,
		// samples: user_id NULL jhj is_system_template (TDD 4.3)
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_samples_template_owner') THEN
				ALTER TABLE samples ADD CONSTRAINT chk_samples_template_owner CHECK ((user_id IS NULL) = (is_system_template));
			END IF;
		END $$;`,
		// section_parts: part enum (TDD 4.6)
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_section_parts_part') THEN
				ALTER TABLE section_parts ADD CONSTRAINT chk_section_parts_part CHECK (part IN ('rebana1','rebana2','rebana3','rebana4','bass'));
			END IF;
		END $$;`,
	}

	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("gagal memasang constraint: %w", err)
		}
	}
	return nil
}
