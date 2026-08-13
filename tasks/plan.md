# Implementation Plan: BandJari — Fase 1 (MVP)

## Overview

Mengimplementasikan seluruh Epic E0–E7 dari `docs/core/breakdown.md` (turunan PRD & TDD): aplikasi web penyusun & pemutar pola pukulan rebana Al-Banjari — Song → Section → SectionPart → SoundSlot → Sample, dengan Pattern Launcher (clip launcher) yang berjalan 100% di sisi client via Web Audio API.

**Titik awal kode:** monorepo pnpm+Nx sudah berdiri (template GOTS). Yang sudah ada: koneksi GORM+PostgreSQL, pipeline Swagger→Orval berjalan untuk modul `users`, register/login + JWT, halaman login/register frontend. **Belum ada:** seluruh domain model (Song, Section, SectionPart, SoundSlot, Sample), object storage, dan Launcher.

**Urutan fase mengikuti dependency graph** (fondasi → fitur → template system → playback), konsisten dengan urutan Epic di breakdown.md Bagian 2.

## Architecture Decisions

| # | Keputusan | Alasan |
|---|---|---|
| AD-P1 | **Selaraskan kode starter dengan TDD** — skema `users` disederhanakan ke `email, password_hash, name`; base path API pindah ke `/api/v1`; endpoint auth jadi `/auth/register` & `/auth/login` | TDD adalah kontrak final; field starter (`username`, `phone`, `address`, `role`, `deposit`) tidak ada di TDD Bagian 4.2 dan menambah friksi validasi tanpa kebutuhan produk |
| AD-P2 | **Migrasi: GORM AutoMigrate + SQL constraint idempotent** (CHECK, unique lintas kolom) dijalankan saat startup, bukan golang-migrate | Konsisten dengan pola starter saat ini; CHECK constraint (`bpm BETWEEN 20 AND 400`, `user_id IS NULL ↔ is_system_template`) tidak bisa diekspresikan via tag GORM sehingga dieksekusi sebagai `db.Exec` idempotent |
| AD-P3 | **Object storage:** MinIO via `docker-compose` (dev) + Cloudflare R2 (staging/prod), SDK `aws-sdk-go-v2` dengan endpoint S3-compatible yang dikonfigurasi lewat env | Sesuai AD-4 TDD (zero egress fee, signed URL). SDK tunggal untuk kedua provider |
| AD-P4 | **Signed URL 60 menit** untuk semua akses audio; frontend fetch langsung ke storage, tidak lewat backend | Sesuai TDD Bagian 6.6 — backend tidak jadi bottleneck streaming |
| AD-P5 | **Validasi `steps` & proteksi referensi seluruhnya di service layer Go** (+ constraint DB sebagai lapisan kedua), bukan CHECK statis | Himpunan karakter valid dinamis per SectionPart (FR-SEQ-02); NFR-05 |
| AD-P6 | **Auth context:** token tetap di localStorage (pola starter), ditambah helper `GetCurrentUserID(c)` untuk klaim JWT, middleware `optional_auth.go` (lanjut sebagai Guest) & `owner_check.go` (403) | Sesuai TDD Bagian 6.8 / AD-8 |
| AD-P7 | **Playback engine dibangun bertahap:** engine inti (worker+scheduler) di Phase 7, tapi subset "preview 1 SectionPart" dipakai lebih awal di Phase 5 (FR-SEQ-05) | Menghindari duplikasi logic audio; sesuai catatan breakdown E5-5 |
| AD-P8 | **Testing:** unit test Go di service layer (validator, proteksi, duplicate), Vitest untuk logic scheduler/quantized; integration test endpoint dengan DB test lokal. Tidak ada testcontainers di fase awal | Seimbang dengan TDD Bagian 11 tanpa menambah infrastruktur berat |

## Task List

> Format: setiap task punya acceptance criteria (AC), verification (V), dependencies (D), files likely touched (F), estimasi. Ukuran: XS/S/M/L. Task XL dilarang — sudah dipecah. Mapping ke story breakdown.md dicantumkan di judul task.

---

### Phase 1: Fondasi & Pelurusan (E0 selesai + E1)

#### Task 1: Selaraskan skema `users` dengan TDD (Story E0-2, E1-1)

**Description:** Sederhanakan model `User` ke `email` (unique), `password_hash` (bcrypt), `name` — hapus `username`, `phone`, `address`, `role`, `deposit` beserta penggunaannya di service/DTO/frontend. Perbarui `dto.UserResponse`/`CreateUserRequest`.

**Acceptance criteria:**
- [ ] Tabel `users` hasil migrate hanya berisi kolom sesuai TDD 4.2 (`id, email, password_hash, name, created_at, updated_at, deleted_at`)
- [ ] Registrasi hanya meminta `email`, `password`, `name`; `email` unik (400 jika duplikat)

**Verification:**
- [ ] `cd apps/api && go build ./...` sukses
- [ ] `cd apps/api && go test ./...` (test unit baru untuk service user: duplikat email ditolak)
- [ ] `cd apps/platform && pnpm build` sukses setelah form disesuaikan

**Dependencies:** None
**Files likely touched:** `apps/api/model/user.go`, `apps/api/dto/user.go`, `apps/api/service/user_service.go`, `apps/api/repository/user_repository.go`, `apps/platform/src/features/auth/components/LoginForm.tsx`, `RegisterForm.tsx`, `AuthContext.tsx`
**Estimated scope:** M

#### Task 2: Pindahkan base path ke `/api/v1` + endpoint `auth/*` (Story E0-4, E1-1)

**Description:** Group `/api/v1` di `main.go`; pindahkan register/login ke `POST /api/v1/auth/register` & `POST /api/v1/auth/login`; perbarui anotasi Swagger; regenerasi Swagger + Orval; perbarui `API_URL` mutator frontend.

**Acceptance criteria:**
- [ ] Endpoint lama (`/api/users/*`) tidak ada lagi; endpoint baru sesuai TDD 6.1
- [ ] `swagger.json` menampilkan base path `/api/v1`; Orval menghasilkan hooks untuk `auth`
- [ ] Login/register dari UI tetap berfungsi end-to-end

**Verification:**
- [ ] `cd apps/api && go run github.com/swaggo/swag/cmd/swag@latest init -g main.go` tanpa error, diff docs konsisten
- [ ] `cd apps/platform && pnpm generate:api` tanpa error
- [ ] Manual: register → login → `GET /api/v1/users` dengan token

**Dependencies:** Task 1
**Files likely touched:** `apps/api/main.go`, `apps/api/handler/user_handler.go`, `apps/api/docs/*` (generated), `apps/platform/src/api/mutator/custom-instance.ts`, `apps/platform/src/api/**` (generated)
**Estimated scope:** S

#### Task 3: Hardening klaim JWT + middleware `optional_auth.go` (Story E1-2)

**Description:** Buat `utility/claims.go` (ekstrak `user_id` dari MapClaims sebagai `uint`, tangani tipe `float64` dari JSON). Buat `middleware/optional_auth.go`: jika token valid → set context user; jika tidak ada → lanjut sebagai Guest (context user `nil`), **tidak** menolak request.

**Acceptance criteria:**
- [ ] `GetCurrentUserID(c)` mengembalikan `*uint` (nil saat Guest), tanpa panic saat klaim tipe tidak sesuai
- [ ] `optional_auth` tidak pernah mengembalikan 401

**Verification:**
- [ ] `cd apps/api && go test ./...` — test unit: token valid/invalid/kosong
- [ ] `go vet ./...` bersih

**Dependencies:** Task 2
**Files likely touched:** `apps/api/utility/claims.go` (baru), `apps/api/middleware/optional_auth.go` (baru), `apps/api/middleware/auth.go`
**Estimated scope:** S

#### Task 4: Middleware `owner_check.go` (Story E1-2)

**Description:** Middleware/helper validasi kepemilikan resource: bandingkan `user_id` resource dengan `currentUserID` dari context; 403 jika bukan pemilik (FR-AUTH-02). Dipasang saat resource Song/Sample sudah ada (dipakai mulai Phase 2).

**Acceptance criteria:**
- [ ] Resource milik user lain → 403; milik sendiri → lanjut
- [ ] Guest (context nil) → 403 untuk aksi mutasi

**Verification:**
- [ ] `go test ./...` — test unit dengan context mock
- [ ] Dipakai oleh endpoint Song pertama (Task 9) tanpa regresi

**Dependencies:** Task 3
**Files likely touched:** `apps/api/middleware/owner_check.go` (baru)
**Estimated scope:** S

#### Task 5: Sinkronkan frontend auth + mutator (Story E1-1, E1-3)

**Description:** Sesuaikan form login/register dengan skema user baru (nama/email/password), perbarui tipe `User` di `AuthContext`, dan pastikan state Guest vs User tersedia lintas fitur (dasar `useCurrentUser`).

**Acceptance criteria:**
- [ ] Register/login form hanya meminta field sesuai TDD
- [ ] `AuthContext` mengekspos `user`, `isAuthenticated`, `isGuest` yang konsisten
- [ ] UI tetap berfungsi setelah Orval regenerate (Task 2)

**Verification:**
- [ ] `cd apps/platform && pnpm check && pnpm build`
- [ ] Manual: register → login → logout di browser

**Dependencies:** Task 2
**Files likely touched:** `apps/platform/src/features/auth/*`, `apps/platform/src/api/mutator/custom-instance.ts`
**Estimated scope:** S

#### Task 6: Komponen `LoginPromptInline` (Story E1-3)

**Description:** Komponen prompt "Login untuk edit" yang muncul di tempat aksi diklik (modal/inline), bukan redirect paksa (FR-AUTH-07). Siap dipakai ulang oleh fitur E3/E4/E5.

**Acceptance criteria:**
- [ ] Saat Guest klik kontrol edit → prompt muncul di lokasi yang sama; Guest bisa menutupnya dan tetap di halaman
- [ ] Prompt menyediakan link login/register

**Verification:**
- [ ] `cd apps/platform && pnpm check && pnpm build`
- [ ] Manual: akses halaman sebagai Guest, klik kontrol edit

**Dependencies:** Task 5
**Files likely touched:** `apps/platform/src/features/auth/components/LoginPromptInline.tsx` (baru)
**Estimated scope:** M

#### Task 7: Fondasi object storage (Story E0-3)

**Description:** Tambah `aws-sdk-go-v2` (S3) ke go.mod; konfigurasi env (endpoint, bucket, access key); `service/storage_service.go` dengan `Upload(ctx, key, data)` & `GenerateSignedURL(key, 60m)`; `docker-compose.yml` untuk MinIO di root; perbarui `.env.example`.

**Acceptance criteria:**
- [ ] Upload file ke MinIO lokal sukses; signed URL dapat di-fetch tanpa kredensial
- [ ] Key object memakai pola `samples/{userId}/{uuid}.wav` / `samples/system/{uuid}.wav`
- [ ] Konfigurasi provider dapat berganti MinIO ↔ R2 hanya lewat env

**Verification:**
- [ ] `cd apps/api && go build ./...`
- [ ] `docker compose up -d minio` lalu test upload/signed URL via `go run` script sementara
- [ ] `.env.example` diperbarui (tanpa nilai rahasia)

**Dependencies:** None
**Files likely touched:** `apps/api/service/storage_service.go` (baru), `apps/api/config/storage.go` (baru), `apps/api/go.mod/go.sum`, `docker-compose.yml` (baru), `.env.example`
**Estimated scope:** M

**Checkpoint: Fondasi**
- [ ] Semua test backend & frontend lolos
- [ ] Register → login → profile berjalan di `/api/v1`
- [ ] MinIO berjalan lokal; signed URL terverifikasi

---

### Phase 2: Manajemen Song (E2)

#### Task 8: Model & migrasi `Song` (Story E0-2, E2-1)

**Description:** Model GORM `Song` sesuai TDD 4.4/5: `user_id` nullable, `is_system_template` (default false, index), `name`, `bpm` int16, relasi `Sections` (CASCADE). CHECK constraint `bpm 20–400` + `user_id IS NULL ↔ is_system_template` via SQL idempotent.

**Acceptance criteria:**
- [ ] Tabel `songs` sesuai TDD 4.4 termasuk index `(is_system_template)` dan `(user_id)`
- [ ] CHECK constraint menolak `bpm` di luar 20–400 dan kombinasi `user_id`/`is_system_template` tidak konsisten

**Verification:**
- [ ] `cd apps/api && go build ./...`
- [ ] Manual: `INSERT` tidak valid via psql ditolak DB

**Dependencies:** Task 1
**Files likely touched:** `apps/api/model/song.go` (baru), `apps/api/model/base.go` (baru — `BaseModel`), `apps/api/model/part.go` (baru), `apps/api/config/database.go` (AutoMigrate + constraint SQL)
**Estimated scope:** M

#### Task 9: Endpoint Song — create & list (Story E2-1)

**Description:** `song_repository.go`, `song_service.go`, `song_handler.go`, `dto/song_dto.go`. `POST /songs` (name, bpm) dan `GET /songs` (milik user login, wajib auth). `GET /songs/:id` dengan logic akses TDD 6.8 (template → semua boleh; guest → 404; bukan pemilik → 403).

**Acceptance criteria:**
- [ ] `POST /songs` → 201, `user_id` = user login, `is_system_template=false` (FR-SONG-01/02)
- [ ] `GET /songs` → hanya Song milik sendiri (FR-SONG-05)
- [ ] `GET /songs/:id` mematuhi matriks akses TDD 6.8

**Verification:**
- [ ] `cd apps/api && go test ./...` — unit test service (akses guest/owner)
- [ ] `go run github.com/swaggo/swag/cmd/swag@latest init -g main.go` → `cd apps/platform && pnpm generate:api`
- [ ] Manual: curl create/list dengan & tanpa token

**Dependencies:** Task 8, Task 4
**Files likely touched:** `apps/api/model/song.go`, `apps/api/repository/song_repository.go`, `apps/api/service/song_service.go`, `apps/api/handler/song_handler.go`, `apps/api/dto/song_dto.go`, `apps/api/main.go`
**Estimated scope:** M

#### Task 10: Endpoint Song — update, delete, duplicate (Story E2-2, E2-3)

**Description:** `PUT /songs/:id` (name/bpm), `DELETE /songs/:id` (cascade), `POST /songs/:id/duplicate` (deep copy Sections — untuk fase ini cukup struktur yang ada). Proteksi: 403 bila `is_system_template=true` (FR-SONG-08); cek kepemilikan via owner_check.

**Acceptance criteria:**
- [ ] Update/hapus Song milik sendiri berhasil; milik user lain 403 (FR-AUTH-02)
- [ ] Duplikasi menghasilkan Song baru milik user, `is_system_template=false` (FR-SONG-06)
- [ ] Hapus Song menghapus seluruh Section terkait (cascade, NFR-08) — diverifikasi penuh setelah Section ada (Task 13)

**Verification:**
- [ ] `cd apps/api && go test ./...` — unit test service duplicate + proteksi template
- [ ] Manual: curl PUT/DELETE/duplicate

**Dependencies:** Task 9
**Files likely touched:** `apps/api/service/song_service.go`, `apps/api/handler/song_handler.go`, `apps/api/dto/song_dto.go`, `apps/api/main.go`
**Estimated scope:** M

#### Task 11: Frontend — daftar Song & kelola (Story E2-1, E2-2, E2-3)

**Description:** Halaman daftar Song (state kosong), form buat (nama + BPM), aksi edit/hapus (konfirmasi) dan duplikasi, memakai hooks Orval.

**Acceptance criteria:**
- [ ] User melihat daftar Song miliknya; dapat membuat, mengedit, menghapus, menduplikasi dari UI
- [ ] UI sesuai wireframe layar "Song List" (ringkas, bukan pixel-perfect)

**Verification:**
- [ ] `cd apps/platform && pnpm check && pnpm build`
- [ ] Manual: alur CRUD penuh di browser

**Dependencies:** Task 10
**Files likely touched:** `apps/platform/src/features/song/**` (baru), `apps/platform/src/routes/_authenticated/**`
**Estimated scope:** M

**Checkpoint: Song**
- [ ] Alur buat → lihat → edit → hapus Song end-to-end
- [ ] Akses lintas user ditolak (403/404)

---

### Phase 3: Manajemen Section & BPM (E3)

#### Task 12: Model & migrasi `Section` + `SectionPart` (Story E0-2, E3-1)

**Description:** Model GORM `Section` (song_id CASCADE, name, order_index, bpm_override nullable CHECK 20–400) dan `SectionPart` (section_id CASCADE, part enum, steps text nullable, UNIQUE(section_id, part)) sesuai TDD 4.5/4.6.

**Acceptance criteria:**
- [ ] Tabel sesuai TDD; `UNIQUE(section_id, part)` enforced di DB
- [ ] `bpm_override` NULL ditolak jika di luar 20–400 saat terisi

**Verification:**
- [ ] `cd apps/api && go build ./...`
- [ ] Manual: psql cek constraint

**Dependencies:** Task 8
**Files likely touched:** `apps/api/model/section.go`, `apps/api/model/section_part.go` (baru), `apps/api/config/database.go`
**Estimated scope:** M

#### Task 13: `POST /songs/:songId/sections` — auto 5 SectionPart (Story E3-1)

**Description:** Endpoint buat Section: validasi kepemilikan Song induk, set `order_index` otomatis, buat tepat 5 SectionPart (5 enum Part) dalam transaksi. (Pembuatan SoundSlot default menyusul di Task 23.)

**Acceptance criteria:**
- [ ] Section baru selalu punya tepat 5 SectionPart, urutan `order_index` benar (FR-SEC-02)
- [ ] Section milik Song user lain ditolak 403

**Verification:**
- [ ] `cd apps/api && go test ./...` — test service: 5 parts dibuat transaksional
- [ ] Manual: curl POST + cek DB

**Dependencies:** Task 12, Task 9
**Files likely touched:** `apps/api/model/section.go`, `apps/api/repository/section_repository.go`, `apps/api/service/section_service.go`, `apps/api/handler/section_handler.go`, `apps/api/dto/section_dto.go`, `apps/api/main.go`
**Estimated scope:** M

#### Task 14: Endpoint Section — update, reorder, delete, duplicate (Story E3-2, E3-3, E3-4)

**Description:** `PUT /sections/:id` (name, bpm_override — termasuk set null), `PUT /sections/:id/reorder`, `DELETE /sections/:id` (cascade SectionPart), `POST /sections/:id/duplicate`.

**Acceptance criteria:**
- [ ] Semua aksi dibatasi pemilik (403 selain pemilik) (FR-AUTH-02)
- [ ] `bpm_override` bisa diset & dikosongkan (FR-SEC-08/09)
- [ ] Reorder memperbarui `order_index` seluruh Section Song terkait
- [ ] Duplikasi Section menghasilkan 5 SectionPart baru (FR-SEC-07)

**Verification:**
- [ ] `cd apps/api && go test ./...` — unit test service
- [ ] Swagger + Orval regenerate
- [ ] Manual: curl keempat endpoint

**Dependencies:** Task 13
**Files likely touched:** `apps/api/service/section_service.go`, `apps/api/handler/section_handler.go`, `apps/api/dto/section_dto.go`, `apps/api/main.go`
**Estimated scope:** M

#### Task 15: Frontend — Section strip & BPM badge (Story E3-1 s/d E3-4)

**Description:** Halaman detail Song: chip horizontal Section (tambah/edit/hapus/duplikasi, drag & drop reorder), input BPM override per Section, badge BPM (★ saat override aktif).

**Acceptance criteria:**
- [ ] User mengelola Section sesuai AC-1; badge override tampil benar
- [ ] Reorder tersimpan ke backend

**Verification:**
- [ ] `cd apps/platform && pnpm check && pnpm build`
- [ ] Manual: alur kelola Section penuh

**Dependencies:** Task 14, Task 11
**Files likely touched:** `apps/platform/src/features/section/**` (baru)
**Estimated scope:** M

**Checkpoint: Song + Section**
- [ ] Song dengan banyak Section tersimpan, urutan & BPM override benar

---

### Phase 4: Manajemen Sample Audio (E4)

#### Task 16: Model & migrasi `Sample` (Story E0-2, E4-1)

**Description:** Model GORM `Sample` sesuai TDD 4.3: `user_id` nullable, `is_system_template`, `name`, `object_key` (json:"-"), `file_size_bytes`, `part` enum + CHECK; constraint `user_id IS NULL ↔ is_system_template`; index `(user_id, part)` & `(is_system_template, part)`.

**Acceptance criteria:**
- [ ] Tabel `samples` sesuai TDD 4.3 + index + CHECK constraint

**Verification:**
- [ ] `cd apps/api && go build ./...`
- [ ] Manual: psql cek constraint

**Dependencies:** Task 8 (BaseModel + part enum tersedia)
**Files likely touched:** `apps/api/model/sample.go` (baru), `apps/api/config/database.go`
**Estimated scope:** S

#### Task 17: Upload Sample (Story E4-1)

**Description:** `POST /samples` multipart (file, name, part): validasi magic bytes `.wav` via `gabriel-vasile/mimetype` (promosi ke dependensi langsung), ukuran ≤5MB (413), format salah (415); upload ke object storage `samples/{userId}/{uuid}.wav`; simpan metadata (FR-SAMP-01/02/03/06).

**Acceptance criteria:**
- [ ] File `.wav` valid ≤5MB → 201 + metadata; `.mp3` → 415; >5MB → 413
- [ ] Sample tersimpan independen (tidak terikat Song/Section) (FR-SAMP-03)

**Verification:**
- [ ] `cd apps/api && go test ./...` — unit test `utility/audio_validator.go`
- [ ] Manual: curl upload ke MinIO, cek object muncul

**Dependencies:** Task 16, Task 7
**Files likely touched:** `apps/api/utility/audio_validator.go` (baru), `apps/api/repository/sample_repository.go`, `apps/api/service/sample_service.go`, `apps/api/handler/sample_handler.go`, `apps/api/dto/sample_dto.go`, `apps/api/main.go`
**Estimated scope:** M

#### Task 18: Library Sample — list, rename, delete dengan proteksi (Story E4-2, E4-3)

**Description:** `GET /samples?part=`, `PUT /samples/:id` (rename), `DELETE /samples/:id`. Proteksi: 409 jika direferensikan SoundSlot (bergantung `ON DELETE RESTRICT` — aktif penuh setelah Task 21; sebelumnya cek aplikasi), 403 jika `is_system_template=true` (FR-SAMP-12).

**Acceptance criteria:**
- [ ] List hanya menampilkan milik user login + filter part (FR-SAMP-05)
- [ ] Delete Sample yang direferensikan → 409 + pesan jelas (FR-SAMP-08); setelah referensi dilepas → sukses
- [ ] Rename/delete Sample template → 403

**Verification:**
- [ ] `cd apps/api && go test ./...` — unit test proteksi
- [ ] Manual: curl alur 409 → lepas referensi → hapus

**Dependencies:** Task 17
**Files likely touched:** `apps/api/service/sample_service.go`, `apps/api/handler/sample_handler.go`, `apps/api/dto/sample_dto.go`
**Estimated scope:** M

#### Task 19: Playback URL Sample (Story E4-4)

**Description:** `GET /samples/:id/playback-url` → signed URL 60 menit. Berlaku untuk Sample milik user (pemilik saja) maupun Sample template (siapapun boleh, mendukung Guest & FR-SAMP-13).

**Acceptance criteria:**
- [ ] Signed URL valid, kadaluarsa 60 menit, file dapat di-fetch langsung dari storage
- [ ] Akses ke Sample milik user lain → 403/404 (NFR-04)

**Verification:**
- [ ] Manual: curl signed URL untuk sample user & template
- [ ] `go test ./...` untuk logic izin

**Dependencies:** Task 18
**Files likely touched:** `apps/api/service/sample_service.go`, `apps/api/handler/sample_handler.go`, `apps/api/main.go`
**Estimated scope:** S

#### Task 20: Frontend — Sample Library + upload (Story E4-1, E4-2, E4-4)

**Description:** Halaman library (grid card, filter Part, kelompok "Sample Saya" vs "Sample Bawaan" — yang kedua terisi setelah Phase 6), form upload (nama, part, file picker pre-check), tombol preview (▶) via playback-url, pesan 409 yang jelas.

**Acceptance criteria:**
- [ ] Upload/rename/delete/preview Sample dari UI; pesan error 409 informatif (AC-6)

**Verification:**
- [ ] `cd apps/platform && pnpm check && pnpm build`
- [ ] Manual: alur library penuh

**Dependencies:** Task 19
**Files likely touched:** `apps/platform/src/features/sample/**` (baru)
**Estimated scope:** M

**Checkpoint: Sample**
- [ ] Upload → preview → reuse → proteksi hapus terverifikasi end-to-end

---

### Phase 5: SoundSlot & Sequencer (E5)

#### Task 21: Model & migrasi `SoundSlot` (Story E0-2, E5-1)

**Description:** Model GORM `SoundSlot` sesuai TDD 4.6a: `section_part_id` CASCADE, `label` (64), `key` CHAR(1), `sample_id` nullable `ON DELETE RESTRICT`, `order_index`, UNIQUE(section_part_id, key).

**Acceptance criteria:**
- [ ] Tabel + constraint unik sesuai TDD; hapus Sample yang direferensikan ditolak DB (FR-SAMP-08)

**Verification:**
- [ ] `cd apps/api && go build ./...`
- [ ] Manual: psql uji RESTRICT

**Dependencies:** Task 12, Task 16
**Files likely touched:** `apps/api/model/sound_slot.go` (baru), `apps/api/config/database.go`
**Estimated scope:** S

#### Task 22: Endpoint SoundSlot + proteksi key (Story E5-1, E5-2)

**Description:** `POST /section-parts/:id/sound-slots` (label, key, sample_id opsional — 400 jika key duplikat), `PUT /sound-slots/:id` (ubah label/key/sample_id; set sample_id null mendukung FR-SAMP-10), `DELETE /sound-slots/:id`. Proteksi: 409 hapus / 400 ubah key jika key masih dipakai di `steps` (FR-SLOT-05/06).

**Acceptance criteria:**
- [ ] Key unik per SectionPart ditegakkan (duplikat → 400) (FR-SLOT-02)
- [ ] Hapus/ubah key yang dipakai `steps` → ditolak dengan pesan jelas (AC-8)
- [ ] Set `sample_id` null berhasil (FR-SAMP-10)

**Verification:**
- [ ] `cd apps/api && go test ./...` — unit test proteksi & validasi
- [ ] Swagger + Orval regenerate

**Dependencies:** Task 21, Task 24 (steps validator — boleh paralel, test proteksi digabung)
**Files likely touched:** `apps/api/repository/sound_slot_repository.go`, `apps/api/service/sound_slot_service.go`, `apps/api/handler/sound_slot_handler.go`, `apps/api/dto/sound_slot_dto.go`, `apps/api/main.go`
**Estimated scope:** M

#### Task 23: Default SoundSlot saat Section dibuat + auto-attach Sample Template (Story E5-1, FR-SLOT-09)

**Description:** Perluas `section_service.go` (Task 13): saat Section dibuat, tiap SectionPart otomatis mendapat 2 SoundSlot default ("Tak"/`T`, "Dung"/`D`); cari Sample Template System (`is_system_template=true`, part cocok) dan isi `sample_id` bila ada — fallback `NULL` tanpa error (TDD 6.3/6.5).

**Acceptance criteria:**
- [ ] Section baru → 5 SectionPart × 2 SoundSlot default (AC-10)
- [ ] Sample template terpasang otomatis bila tersedia; tanpa template tidak error

**Verification:**
- [ ] `cd apps/api && go test ./...` — test service (dengan/ tanpa template)
- [ ] Manual: buat Section, cek SoundSlot + sample_id

**Dependencies:** Task 22
**Files likely touched:** `apps/api/service/section_service.go`, `apps/api/repository/sample_repository.go`
**Estimated scope:** M

#### Task 24: `PUT /section-parts/:id` + validator `steps` dinamis (Story E5-4)

**Description:** `GET /sections/:id/parts` (nested SoundSlots) dan `PUT /section-parts/:id` (update `steps`). `utility/steps_validator.go`: setiap karakter `steps` harus merujuk `key` SoundSlot pada SectionPart terkait (query DB, bukan regex) (FR-SEQ-01–04).

**Acceptance criteria:**
- [ ] `steps` dengan karakter di luar key terdaftar → 400 (FR-SEQ-02)
- [ ] `steps` kosong/null diperbolehkan (FR-SEQ-04); panjang bebas (FR-SEQ-03)
- [ ] GET parts mengembalikan 5 SectionPart + SoundSlots nested (FR-SEQ-01)

**Verification:**
- [ ] `cd apps/api && go test ./...` — unit test validator (kasus valid/invalid/kosong)
- [ ] Swagger + Orval regenerate

**Dependencies:** Task 22
**Files likely touched:** `apps/api/utility/steps_validator.go` (baru), `apps/api/repository/section_part_repository.go`, `apps/api/service/section_part_service.go`, `apps/api/handler/section_part_handler.go`, `apps/api/dto/section_part_dto.go`, `apps/api/main.go`
**Estimated scope:** M

#### Task 25: Frontend — SoundSlotManager + SamplePicker (Story E5-1, E5-3)

**Description:** Komponen `SoundSlotManager.tsx` (tabel Label/Key/Sample per Part, tambah/edit/hapus) + `SamplePicker.tsx` (dropdown dua optgroup "Bawaan"/"Saya") + pesan error 409/400 yang mengarahkan user membersihkan steps.

**Acceptance criteria:**
- [ ] User menambah jenis bunyi dengan label+key bebas; duplikat key terblokir dengan pesan jelas
- [ ] Picker menampilkan dua kelompok; "Bawaan" kosong tanpa error sebelum seeding (Phase 6)

**Verification:**
- [ ] `cd apps/platform && pnpm check && pnpm build`
- [ ] Manual: alur SoundSlot penuh di Sequencer Mode

**Dependencies:** Task 24
**Files likely touched:** `apps/platform/src/features/sequencer/components/SoundSlotManager.tsx`, `SamplePicker.tsx` (baru)
**Estimated scope:** M

#### Task 26: Frontend — StepGrid + serialisasi steps (Story E5-4)

**Description:** `StepGrid.tsx`: grid klik-per-kotak, jumlah baris dinamis mengikuti jumlah SoundSlot; serialisasi grid ↔ string `steps` (encode/decode); validasi cermin terhadap daftar key aktif.

**Acceptance criteria:**
- [ ] Grid mencerminkan `steps` string secara presisi (round-trip encode/decode)
- [ ] Jumlah baris berubah saat SoundSlot ditambah/dihapus (AC-7)

**Verification:**
- [ ] `cd apps/platform && pnpm test` — unit test encode/decode
- [ ] `pnpm check && pnpm build`

**Dependencies:** Task 25
**Files likely touched:** `apps/platform/src/features/sequencer/components/StepGrid.tsx` (baru), `apps/platform/src/features/sequencer/utils/steps-codec.ts` (baru)
**Estimated scope:** M

#### Task 27: Preview audio per SectionPart saat edit (Story E5-5, FR-SEQ-05)

**Description:** Playback preview satu SectionPart (subset engine Phase 7): fetch signed URL → decode `AudioBuffer` → loop sederhana mengikuti BPM Section; tombol play/stop di Sequencer Mode.

**Acceptance criteria:**
- [ ] Preview memutar pattern satu Part sesuai steps & sample; step tanpa sample senyap tanpa error (AC-5)

**Verification:**
- [ ] `cd apps/platform && pnpm build`
- [ ] Manual: preview di Sequencer Mode dengan sample terpasang & kosong

**Dependencies:** Task 26
**Files likely touched:** `apps/platform/src/features/sequencer/hooks/usePartPreview.ts` (baru)
**Estimated scope:** M

**Checkpoint: Sequencer**
- [ ] Susun pattern multi-bunyi (mis. T/D/K) tersimpan & tervalidasi; preview terdengar

---

### Phase 6: Template System (E6)

#### Task 28: Seeder Sample Template + endpoint templates (Story E6-1)

**Description:** `seeders/sample_templates.go`: baca folder audio lokal → upload ke `samples/system/{uuid}.wav` → insert `is_system_template=true, user_id=NULL`. `GET /samples/templates?part=` (auth opsional). Proteksi 403 pada PUT/DELETE template (sebagian sudah di Task 18).

**Acceptance criteria:**
- [ ] Seeder idempotent (jalan ulang tidak duplikasi)
- [ ] 10 file minimal (5 Part × Tak/Dung) tersedia via `GET /samples/templates` (FR-SAMP-11)
- [ ] Template read-only: rename/delete → 403 (FR-SAMP-12)

**Verification:**
- [ ] `cd apps/api && go run seeders/sample_templates.go` sukses; cek DB & MinIO
- [ ] `go test ./...` + Swagger regen

**Dependencies:** Task 19
**Files likely touched:** `apps/api/seeders/sample_templates.go` (baru), `apps/api/service/sample_service.go`, `apps/api/main.go`
**Estimated scope:** M

#### Task 29: Seeder Song Template + endpoint templates (Story E6-2)

**Description:** `seeders/song_templates.go`: insert Song template (`is_system_template=true`) dengan Section standar (Awalan/Dasar/Naik/Turun/Penutup), SectionPart, SoundSlot, `steps` — merujuk Sample Template dari Task 28. `GET /songs/templates` (auth opsional). Proteksi 403 edit/hapus template (sebagian di Task 10).

**Acceptance criteria:**
- [ ] Minimal 1 lagu penuh siap dimainkan (FR-SONG-07)
- [ ] `GET /songs/templates` dapat diakses Guest tanpa token (FR-AUTH-04)
- [ ] Edit/hapus Song template → 403 (FR-SONG-08)

**Verification:**
- [ ] `cd apps/api && go run seeders/song_templates.go` sukses
- [ ] Manual: curl `GET /songs/templates` tanpa token → 200

**Dependencies:** Task 28, Task 24
**Files likely touched:** `apps/api/seeders/song_templates.go` (baru), `apps/api/service/song_service.go`, `apps/api/main.go`
**Estimated scope:** M (backend) + konten steps (terpisah — lihat Open Questions)

#### Task 30: Frontend — Song Bawaan, akses Guest, duplikasi template (Story E6-2, E6-3)

**Description:** Halaman/tab "Song Bawaan" terpisah dari "Lagu Saya"; Guest dapat membuka Launcher & Sequencer read-only Song template; tombol "Duplikasi ke Song Saya" (login wajib).

**Acceptance criteria:**
- [ ] Guest melihat & memainkan Song template tanpa login (AC-11)
- [ ] Guest menekan kontrol edit → `LoginPromptInline` tanpa redirect (AC-12)
- [ ] User login dapat menduplikasi template ke Song miliknya (FR-SONG-10)

**Verification:**
- [ ] `cd apps/platform && pnpm check && pnpm build`
- [ ] Manual: uji alur Guest (AC-11, AC-12) & duplikasi

**Dependencies:** Task 29, Task 6
**Files likely touched:** `apps/platform/src/features/song/components/SongTemplateList.tsx` (baru), `apps/platform/src/routes/**`
**Estimated scope:** M

**Checkpoint: Template System**
- [ ] Guest bisa buka aplikasi → mainkan lagu bawaan tanpa login; User bisa duplikasi & modifikasi

---

### Phase 7: Pattern Launcher (E7)

#### Task 31: Playback engine inti — worker & scheduler (Story E7-1)

**Description:** `clock.worker.ts` (timer independen, postMessage tick), `scheduler.ts` (lookahead ~200ms, jadwalkan ke `AudioContext` dengan timestamp presisi, hitung step per tick), dipicu BPM efektif Section.

**Acceptance criteria:**
- [ ] Timing stabil tanpa drift saat tab background (NFR-01/03)
- [ ] Loop Section mengikuti panjang `steps` masing-masing (AC-2)

**Verification:**
- [ ] `cd apps/platform && pnpm test` — unit test math scheduling & quantize (Vitest, mock AudioContext)
- [ ] Manual: ukur deviasi timing dengan metronom referensi

**Dependencies:** Task 27 (subset preview membuktikan pola fetch/decode)
**Files likely touched:** `apps/platform/src/features/launcher/engine/clock.worker.ts`, `scheduler.ts` (baru)
**Estimated scope:** M

#### Task 32: AudioBuffer cache + prefetch (Story E7-1)

**Description:** `audio-buffer-cache.ts` (Map<sampleId, AudioBuffer> in-memory); prefetch & decode seluruh Sample yang direferensikan saat Launcher dibuka (via playback-url).

**Acceptance criteria:**
- [ ] Pad ditekan tanpa latency decode (semua buffer siap sebelum playback)
- [ ] Cache dipakai ulang saat re-trigger Section

**Verification:**
- [ ] `cd apps/platform && pnpm test` — unit test cache hit/miss
- [ ] Manual: DevTools Network — tidak ada refetch saat pad ditekan berulang

**Dependencies:** Task 31
**Files likely touched:** `apps/platform/src/features/launcher/engine/audio-buffer-cache.ts` (baru), `apps/platform/src/features/launcher/hooks/useLauncherPlayback.ts` (baru)
**Estimated scope:** M

#### Task 33: LauncherGrid + quantized trigger + indikator (Story E7-2)

**Description:** `section-player.ts` (state `active`/`pendingNext`, tunggu akhir siklus sebelum pindah — FR-PLAY-04), `LauncherGrid.tsx` (1 pad per Section, dinamis), `PlaybackIndicator.tsx` (Section aktif + posisi step).

**Acceptance criteria:**
- [ ] Pindah pad di tengah siklus → Section lama menyelesaikan siklus dulu (AC-4)
- [ ] Pad mencerminkan Section aktif; jumlah pad dinamis (FR-PLAY-01/07/08)

**Verification:**
- [ ] `cd apps/platform && pnpm test` — test quantized trigger (simulasi trigger tengah siklus)
- [ ] Manual: uji transisi antar Section

**Dependencies:** Task 32
**Files likely touched:** `apps/platform/src/features/launcher/engine/section-player.ts`, `components/LauncherGrid.tsx`, `components/PlaybackIndicator.tsx` (baru)
**Estimated scope:** M

#### Task 34: Hard cut BPM + Stop + silent step (Story E7-3, E7-4)

**Description:** BPM efektif (`bpm_override` ?? `song.bpm`) diterapkan seketika saat Section baru mulai, tanpa interpolasi (FR-PLAY-11, AC-9); tombol Stop menghentikan worker & seluruh schedule (FR-PLAY-06); step dengan SoundSlot tanpa sample → senyap, tidak error (FR-PLAY-09).

**Acceptance criteria:**
- [ ] Transisi Section dengan BPM berbeda terasa hard cut (AC-9)
- [ ] Stop mematikan seluruh audio & timer
- [ ] Playback berjalan normal dengan campuran slot terisi/kosong (AC-5)

**Verification:**
- [ ] `cd apps/platform && pnpm test` — unit test pemilihan BPM efektif
- [ ] Manual: Section 70 BPM → 90 BPM terasa langsung berubah

**Dependencies:** Task 33
**Files likely touched:** `apps/platform/src/features/launcher/engine/section-player.ts`, `scheduler.ts`, `components/LauncherGrid.tsx`
**Estimated scope:** M

#### Task 35 (Could): Mute per Part (Story E7-5)

**Description:** Kontrol mute/unmute per Part di Launcher (FR-PLAY-10).

**Acceptance criteria:**
- [ ] Mute satu Part tidak memengaruhi Part lain; toggle berfungsi saat playback berjalan

**Verification:**
- [ ] `cd apps/platform && pnpm build` + manual

**Dependencies:** Task 34
**Files likely touched:** `apps/platform/src/features/launcher/components/LauncherGrid.tsx`, `hooks/useLauncherPlayback.ts`
**Estimated scope:** S

**Checkpoint: Launcher (Final)**
- [ ] Alur lengkap: buat Song → susun Section & pattern → upload sample → mainkan live dengan transisi musikal
- [ ] AC-1 s/d AC-12 PRD terverifikasi (minimal manual)
- [ ] Uji kompatibilitas browser (Chrome/Firefox/Safari) + layar sentuh (NFR-02/07)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Audio sample asli rebana belum tersedia (E6 seeding butuh 10+ file) | High — Template System tidak bisa di-seed | Tentukan pemilik konten sejak awal (Open Question 1); fallback: generate sample sederhana sementara untuk development |
| Skema `users` diubah (Task 1) → user yang sudah terdaftar di DB dev hilang/rusak | Low (dev only) | Reset DB dev saat migrasi; tidak ada data produksi |
| Timing playback tidak presisi di browser tertentu (iOS/Safari `AudioContext` suspend) | Med | Resume `AudioContext` pada gesture user pertama; uji manual browser matrix di checkpoint akhir |
| CHECK constraint via SQL idempotent bisa konflik dengan AutoMigrate saat kolom berubah | Med | Semua constraint didefinisikan satu fungsi `ensureConstraints()` dengan `IF NOT EXISTS`; test saat migrate di DB kosong |
| Orval regenerate berpotensi merusak komponen yang memakai tipe lama | Med | Setiap regenerasi langsung diikuti `pnpm check` (dimasukkan ke verification tiap task) |
| Estimasi E5/E7 (Sequencer & Launcher) meleset — keduanya L–XL di breakdown | Med | Sudah dipecah menjadi task M; checkpoint per phase untuk evaluasi ulang |
| MinIO belum tersedia di mesin developer | Low | `docker-compose.yml` satu perintah; dokumentasikan di README |

## Open Questions

1. ~~Pemilik konten seeding~~ **RESOLVED (13-08-2026):** Audio sample rebana asli tersedia di `docs/src/SAMPLING HADRAH AB CHANNEL/` (13 file `.wav`: BASS DER/DUK/DUNG, GL DUK/TEK, GW DUK/TEK, LANANG DEP/DUK/TEK, WEDOK DEP/DUK/TEK). Mapping file → Part → label SoundSlot ditentukan saat Task 28. **Masih tertunda:** susunan `steps` & lagu/section untuk Song Template System — akan disusun pemilik produk; Task 29 menunggu konten ini (gunakan placeholder bila Phase 6 dimulai lebih dulu).
2. **Kredensial Cloudflare R2** — kapan tersedia? Development bisa jalan penuh dengan MinIO; R2 hanya dibutuhkan untuk deploy staging/prod.
3. ~~Skema users~~ **RESOLVED (13-08-2026):** field starter (`phone`/`address`/`role`/`deposit`/`username`) dihapus — skema `users` disesuaikan dengan TDD 4.2.
4. **Testing integration** — cukup dengan unit test + manual (posisi plan ini), atau perlu testcontainers/integration suite terpisah sejak awal?
5. **Urutan rilis** — apakah Guest demo (Phase 6) boleh digeser lebih awal (setelah Phase 5) mengingat nilai demo-nya tinggi? Secara teknis sudah memungkinkan karena dependency E2–E5 selesai.

## Referensi

- `docs/core/brd.md`, `docs/core/prd.md`, `docs/core/tdd.md`, `docs/core/breakdown.md`, `docs/core/wireframe.html`
- GOTS Monorepo Starter Kit: https://github.com/anasMuf/monorepo_gots_starterkit
- Kytaime Throwdown (referensi playback engine): https://github.com/haszari/kytaime

---

# Redesign UI — Fase 1.5 (Total Redesign sesuai Wireframe)

## Overview

Redesign total seluruh halaman frontend agar **struktur & konten tiap layar mengikuti `docs/core/wireframe.html`** (7 layar), tetap memenuhi PRD (FR/AC) & TDD. Wireframe sendiri menegaskan fokusnya adalah validasi **struktur & alur** (`Tujuan dokumen: validasi struktur & alur, bukan visual final`) — sehingga kita adopsi strukturnya 1:1, lalu terapkan visual production-quality (bukan estetika wireframe abu-abu Courier).

## Architecture Decisions (Redesign)

| # | Keputusan | Alasan |
|---|---|---|
| RD-1 | **Design tokens baru di Tailwind v4** (`@theme` di `styles.css`): aksen `brand` teal-800/700 (menggantikan indigo starter yang generik), netral stone, radius `rounded-lg` kartu / `rounded-md` kontrol, tanpa gradien | Sesuai panduan frontend-ui-engineering (hindari "AI aesthetic" indigo/ungu); teal-hijau dalam merepresentasikan nuansa seni Islami rebana |
| RD-2 | **Struktur layar 1:1 wireframe** — termasuk panel "Section Terpilih" + "Ringkasan Song" di halaman detail, grid sequencer terpadu (semua 5 Part dalam satu tabel), dua seksi Sample Library, dan bar transport Launcher | Wireframe adalah kontrak struktur & alur |
| RD-3 | **Backend diperluas minimal**: `section_count` pada daftar Song (meta "N Section") dan `usage_count` pada daftar Sample ("Dipakai di N SoundSlot") via query agregat | Konten wireframe membutuhkan data ini; tanpa mengubah kontrak API yang ada (hanya menambah field respons) |
| RD-4 | **Sequencer jadi grid terpadu multi-Part** (bukan tab per Part): baris = SoundSlot dikelompokkan per Part dengan subheader Part; interaksi tetap klik-per-sel; preview per baris (▶) memutar sample tunggal | Sesuai wireframe layar 3; tetap memenuhi FR-SEQ-01/02, AC-7 |
| RD-5 | **Indikator playback Launcher per pad** (step-dots) + bar transport dengan status "akan pindah ke X di akhir siklus" | FR-PLAY-07/08 + simulasi quantized trigger di wireframe |
| RD-6 | **Mute per Part (FR-PLAY-10, Could)** diimplementasikan sebagai dropdown sederhana di transport Launcher | Wireframe menampilkan tombolnya; biaya rendah (filter part di engine) — keputusan: include |

## Task List — Redesign

### Slice 0: Design tokens & komponen bersama
- [ ] RD-0.1 Token tema di `styles.css` (brand teal, radius, dsb) + ganti variant Button/FormField/ConfirmDialog/Toast
- [ ] RD-0.2 Komponen bersama baru: `Badge` (SYSTEM/★), `SectionHeader`, `EmptyState`, `PageHeader`; app shell/nav konsisten

### Slice 1: Landing (Guest) — layar 0
- [ ] RD-1.1 Kartu Song Template: badge SYSTEM, meta "BPM · N Section", tombol ▶ Main langsung ke Launcher
- [ ] RD-1.2 Kotak CTA "Mau susun lagu sendiri?" + hero

### Slice 2: Daftar Lagu — layar 1
- [ ] RD-2.1 Backend: `section_count` di SongResponse (List & ListTemplates)
- [ ] RD-2.2 Form buat lagu → "Simpan & Lanjut ke Section →" (navigasi ke detail)
- [ ] RD-2.3 Item lagu: meta BPM · N Section, aksi Duplikasi/Hapus; state kosong ♪

### Slice 3: Detail Song / Section — layar 2
- [ ] RD-3.1 Banner read-only Guest (lagu template)
- [ ] RD-3.2 Section strip: pegangan #N + BPM badge ★ + chip + Tambah Section
- [ ] RD-3.3 Panel "Section Terpilih": Buka di Sequencer, Duplikasi, Hapus, kotak BPM override
- [ ] RD-3.4 Panel "Ringkasan Song" (jumlah section, override, kelengkapan sample) + ▶ Buka Launcher

### Slice 4: Sequencer — layar 3
- [ ] RD-4.1 Grid terpadu 5 Part (subheader per Part, baris SoundSlot, badge SYS, preview ▶ per baris)
- [ ] RD-4.2 Toolbar: Play Preview (indikator playhead), kontrol ±8 step, info BPM/panjang
- [ ] RD-4.3 Panel kelola SoundSlot per Part (tabel Label/Key/Sample + 2 optgroup + proteksi)
- [ ] RD-4.4 Aksi: Simpan Perubahan, Preview Section (semua Part), kembali

### Slice 5: Sample Library — layar 4
- [ ] RD-5.1 Backend: `usage_count` di SampleResponse (List & ListTemplates)
- [ ] RD-5.2 Seksi "Sample Bawaan (SYSTEM)" read-only + seksi "Sample Saya"
- [ ] RD-5.3 Kartu sample: tag Part, "Dipakai di N SoundSlot", preview/rename/hapus; state error 409

### Slice 6: Launcher — layar 5
- [ ] RD-6.1 Pad: status per pad (sedang main/menunggu/siap), step-dots, ★, pad placeholder + Section
- [ ] RD-6.2 Transport: status lengkap + Mute per Part + ■ Stop

### Slice 7: Verifikasi
- [ ] RD-7.1 Playwright: alur lengkap + alur Guest (landing → template → sequencer read-only → launcher)
- [ ] RD-7.2 Screenshot tiap layar + bersih console error

## Risks and Mitigations (Redesign)

| Risk | Impact | Mitigation |
|---|---|---|
| Grid sequencer terpadu (5 Part) lebih kompleks dari tab per Part | Med | Pisahkan komponen `SequencerGrid` murni presentasional; state edit tetap per SectionPart |
| Perubahan backend respons (section_count/usage_count) mempengaruhi kontrak Orval | Low | Hanya field tambahan; regen swagger + orval langsung |
| Visual baru mengubah seluruh file → regresi aksesibilitas | Med | Pertahankan ARIA yang ada (role=grid/tab, aria-pressed, label); cek di Slice 7 |
| Mute per Part menambah kompleksitas engine | Low | Filter `ScheduledPart` pada trigger/switch; unit test kecil |
