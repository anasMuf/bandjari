// Seeder promosi admin — sekali jalan, idempotent.
//
// Mencari user berdasarkan email, lalu menaikkan role-nya menjadi "admin".
// Bila email tidak ditemukan atau user sudah ber-role admin, email tsb
// di-SKIP dengan pesan yang jelas dan TIDAK diubah. Mendukung beberapa email
// sekaligus: env ADMIN_EMAILS dipisah koma (default: daftar di bawah);
// ADMIN_EMAIL (tunggal) tetap didukung untuk kompatibilitas.
//
// Jalankan dari apps/api:
//
//	go run ./seeders/promote_admin
//
// Promosi email tertentu:
//
//	ADMIN_EMAILS="a@x.com,b@y.com" go run ./seeders/promote_admin
//
// Atau via Docker (pola sama seperti seeder template, lihat docs/deploy-vps.md):
//
//	docker run --rm -v "$PWD":/src -w /src/apps/api --env-file .env \
//	  -e DB_HOST=postgres -e DB_PORT=5432 --network bandjari_default \
//	  golang:1.25-alpine go run ./seeders/promote_admin
package main

import (
	"api/config"
	"api/model"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"gorm.io/gorm"
)

// defaultAdminEmails — daftar email yang dipromosikan bila ADMIN_EMAILS kosong.
func defaultAdminEmails() []string {
	return []string{
		"anas.muhammadakbar@gmail.com",
		"muhammadadimaulana11@gmail.com",
	}
}

// splitEmails memecah nilai env koma-terpisah, menghapus spasi & entri kosong.
func splitEmails(raw string) []string {
	parts := strings.Split(raw, ",")
	emails := make([]string, 0, len(parts))
	for _, p := range parts {
		if e := strings.TrimSpace(p); e != "" {
			emails = append(emails, e)
		}
	}
	return emails
}

func main() {
	// Prioritas: ADMIN_EMAILS (daftar) > ADMIN_EMAIL (tunggal, kompatibilitas) > default.
	emails := defaultAdminEmails()
	if raw := os.Getenv("ADMIN_EMAILS"); raw != "" {
		emails = splitEmails(raw)
	} else if single := os.Getenv("ADMIN_EMAIL"); single != "" {
		emails = []string{single}
	}

	config.LoadEnv()
	db := config.DBInit()
	// DB baru mungkin belum punya tabel — samakan dengan AutoMigrate main app.
	if err := db.AutoMigrate(&model.User{}); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	for _, email := range emails {
		promote(db, email)
	}
}

// promote menaikkan role satu email menjadi admin; idempotent (SKIP bila sudah
// admin atau tidak ditemukan — email yang tidak ditemukan tidak menghentikan
// pemrosesan email lain dalam daftar).
func promote(db *gorm.DB, email string) {
	var user model.User
	if err := db.Where("email = ?", email).First(&user).Error; err != nil {
		log.Printf("SKIP: user dengan email %q tidak ditemukan — tidak ada yang diubah.", email)
		return
	}

	if user.Role == string(model.RoleAdmin) {
		fmt.Printf("SKIP: %s sudah ber-role admin.\n", email)
		return
	}

	if err := db.Model(&model.User{}).
		Where("id = ?", user.ID).
		Update("role", string(model.RoleAdmin)).Error; err != nil {
		log.Fatalf("gagal mengubah role %s: %v", email, err)
	}

	// Audit trail role_change (E-AUTH-2026 R13) — best-effort.
	if detail, err := json.Marshal(map[string]any{"email": email, "new_role": "admin"}); err == nil {
		db.Create(&model.AuditLog{Action: "role_change", Detail: detail})
	}

	fmt.Printf("DONE: role %s diubah menjadi admin.\n", email)
}
