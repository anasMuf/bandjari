// Seeder promosi admin — sekali jalan, idempotent.
//
// Mencari user berdasarkan email, lalu menaikkan role-nya menjadi "admin".
// Bila email tidak ditemukan atau user sudah ber-role admin, seeder berhenti
// dengan pesan yang jelas dan TIDAK mengubah apa pun.
//
// Jalankan dari apps/api:
//
//	go run ./seeders/promote_admin
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
)

func main() {
	email := os.Getenv("ADMIN_EMAIL")
	if email == "" {
		email = "anas.muhammadakbar@gmail.com"
	}

	config.LoadEnv()
	db := config.DBInit()
	// DB baru mungkin belum punya tabel — samakan dengan AutoMigrate main app.
	if err := db.AutoMigrate(&model.User{}); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	var user model.User
	if err := db.Where("email = ?", email).First(&user).Error; err != nil {
		log.Fatalf("user dengan email %q tidak ditemukan — tidak ada yang diubah.", email)
	}

	if user.Role == string(model.RoleAdmin) {
		fmt.Printf("SKIP: %s sudah ber-role admin.\n", email)
		return
	}

	if err := db.Model(&model.User{}).
		Where("id = ?", user.ID).
		Update("role", string(model.RoleAdmin)).Error; err != nil {
		log.Fatalf("gagal mengubah role: %v", err)
	}

	// Audit trail role_change (E-AUTH-2026 R13) — best-effort.
	if detail, err := json.Marshal(map[string]any{"email": email, "new_role": "admin"}); err == nil {
		db.Create(&model.AuditLog{Action: "role_change", Detail: detail})
	}

	fmt.Printf("DONE: role %s diubah menjadi admin.\n", email)
}
