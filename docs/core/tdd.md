# Technical Design Document (TDD)
## BandJari — Fase 1 (MVP)

| | |
|---|---|
| **Dokumen** | Technical Design Document (TDD) |
| **Produk** | BandJari |
| **Cakupan** | Fase 1 / MVP — sesuai PRD |
| **Versi** | 1.0 |
| **Status** | Draft |
| **Dokumen Terkait** | [PRD](./PRD-bandjari.md) · [BRD](./BRD-bandjari.md) · [Dokumen Konsep](./bandjari-konsep.md) |

> *"BandJari" — bermain musik selayaknya sebuah band, cukup dengan jari.*

---

## 1. Tujuan Dokumen

TDD ini menerjemahkan seluruh *Functional Requirement* (FR) dan *Non-Functional Requirement* (NFR) pada PRD menjadi rancangan teknis konkret: skema database final, kontrak API, arsitektur sistem, dan strategi implementasi — sebagai acuan langsung bagi tim development, tanpa ambiguitas keputusan produk (karena seluruh keputusan produk sudah dikunci di PRD Bagian 10).

Dokumen ini **tidak mengubah** keputusan domain/produk yang telah difinalisasi di PRD — hanya merinci **bagaimana** mengimplementasikannya.

---

## 2. Ruang Lingkup Teknis

Mengikuti cakupan PRD Fase 1: manajemen Song, Section, SectionPart (pola pukulan), Sample audio, dan Pattern Launcher (playback). Autentikasi dasar (login/register) termasuk dalam cakupan sebagai prasyarat modul lain.

Di luar cakupan: breakdown audio otomatis, sharing komunitas, dukungan vokal (lihat PRD Bagian 12).

---

## 3. Keputusan Arsitektur Kunci

| # | Keputusan | Alasan |
|---|---|---|
| AD-1 | Backend: **Go + Echo**, arsitektur **Clean Architecture** (Handler → Service → Repository) | Mengikuti template [GOTS Starter Kit](https://github.com/anasMuf/monorepo_gots_starterkit) yang sudah dipilih sebagai basis proyek |
| AD-2 | ORM: **GORM** + **PostgreSQL** | Sesuai template; relational DB cocok untuk struktur data hierarkis (Song → Section → SectionPart) dengan relasi FK yang jelas |
| AD-3 | Kontrak API: **Swagger annotation → Orval codegen** → React Query hooks | Sesuai template; menghindari penulisan manual tipe TypeScript & fetch di frontend, kontrak selalu sinkron dengan backend |
| AD-4 | Penyimpanan file sample: **Object storage S3-compatible** — **Cloudflare R2** untuk produksi, **MinIO** untuk self-hosted/dev | Keputusan hasil klarifikasi TDD — dipilih atas pertimbangan skalabilitas (NFR-06), zero egress fee (signifikan untuk pola akses BandJari yang sering fetch berulang saat playback Launcher), tidak membebani disk server aplikasi, dan kompatibilitas langsung dengan pola signed-URL di Bagian 6.6. Cloudinary dipertimbangkan namun tidak dipilih karena diferensiasi utamanya (transformasi media on-the-fly) tidak relevan untuk BandJari — lihat Bagian 12 |
| AD-5 | Part sebagai **string constant/enum aplikasi**, bukan tabel relasi terpisah | Sesuai catatan desain di Dokumen Konsep — jumlah Part tetap (5), tidak butuh fleksibilitas tabel relasi |
| AD-6 | Playback engine (lookahead scheduling, Web Worker) berjalan **sepenuhnya di client** | Web Audio API adalah teknologi browser; backend hanya berperan sebagai penyedia data pattern & file audio |
| AD-7 | Validasi `steps` (setiap karakter harus merujuk ke `key` SoundSlot yang terdaftar pada SectionPart yang sama) dilakukan **di backend** (Go, service layer — bukan DB CHECK constraint karena butuh query lintas tabel) sebagai sumber kebenaran, didukung validasi cermin di frontend untuk UX responsif | Backend adalah lapisan pertahanan utama; frontend validation semata tidak cukup (NFR-05). Karena himpunan karakter valid kini dinamis per SectionPart (bukan tetap T/D), validasi tidak bisa lagi berupa regex statis — lihat Bagian 4.6a dan 7 |
| AD-8 | Autentikasi bersifat **opsional** (JWT tidak wajib) pada endpoint GET untuk resource dengan `is_system_template = true`; tetap **wajib** (JWT required) pada seluruh endpoint POST/PUT/DELETE serta endpoint GET untuk resource milik User. Direalisasikan lewat middleware `optional_auth.go` yang berbeda dari `auth.go` (wajib) — lihat Bagian 6.8 dan 10.1 | Keputusan hasil klarifikasi TDD (PRD Bagian 10 keputusan #13–16) — memungkinkan Guest mengakses Song Template System tanpa login (FR-AUTH-04) sambil tetap menegakkan FR-AUTH-01/02/05/06 untuk resource lain |

---

## 4. Skema Database (Final)

### 4.1 Entity Relationship Diagram (Naratif)

```
users
  │
  ├──< samples (1 user punya banyak sample)
  │
  └──< songs (1 user punya banyak song)
        │
        └──< sections (1 song punya banyak section)
              │
              └──< section_parts (1 section selalu punya TEPAT 5 baris)
                     │
                     └──< sound_slots (1 section_part punya BANYAK, dinamis — 0..n)
                            │
                            └── FK sample_id ──> samples.id (nullable)
```

> **Perubahan dari rancangan sebelumnya:** kolom `sample_tak_id`/`sample_dung_id` yang sebelumnya melekat langsung di `section_parts` (2 slot tetap) digantikan oleh tabel relasi baru `sound_slots` (1-ke-banyak, dinamis). Perubahan ini merespons temuan bahwa dinamika pukulan di lapangan tidak selalu terbatas pada 2 jenis bunyi (Tak/Dung) — lihat PRD Bagian 10 keputusan #5.

### 4.2 Tabel: `users`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | |
| `password_hash` | `VARCHAR(255)` | NOT NULL | Bcrypt hash |
| `name` | `VARCHAR(255)` | NOT NULL | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE, INDEX | GORM soft delete |

### 4.3 Tabel: `samples`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | |
| `user_id` | `BIGINT` | FK → `users.id`, **NULLABLE**, INDEX | `NULL` untuk Sample Template System (milik System, bukan User manapun) — lihat catatan di bawah |
| `is_system_template` | `BOOLEAN` | NOT NULL, DEFAULT `false`, INDEX | *(baru)* `true` untuk Sample Template System (PRD Bagian 10 keputusan #10) |
| `name` | `VARCHAR(255)` | NOT NULL | Nama tampilan, mis. "Rebana 1 - Tak Keras" |
| `object_key` | `VARCHAR(512)` | NOT NULL | Path/key file di object storage (bukan URL publik langsung — lihat Bagian 6.6) |
| `file_size_bytes` | `INTEGER` | NOT NULL | Untuk audit & validasi batas 5MB |
| `part` | `VARCHAR(16)` | NOT NULL, CHECK IN (`rebana1`,`rebana2`,`rebana3`,`rebana4`,`bass`) | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE, INDEX | Soft delete |

**Constraint tambahan (CHECK, level aplikasi + DB):** `user_id IS NULL` **jika dan hanya jika** `is_system_template = true` — mencegah kombinasi data yang tidak konsisten (Sample tanpa pemilik yang bukan template, atau Sample template yang punya `user_id`).

> **Perubahan dari rancangan sebelumnya:** kolom `sound` (`CHECK IN ('T','D')`) dihapus dari `samples` — lihat catatan lama di bawah. **Perubahan baru:** `user_id` yang sebelumnya `NOT NULL` diubah menjadi **nullable**, dan ditambahkan kolom `is_system_template`, untuk mendukung **Sample Template System** — Sample bawaan platform yang read-only bagi seluruh User (PRD Bagian 10 keputusan #10–12). Pendekatan "satu tabel dengan flag" dipilih (bukan tabel terpisah `system_samples`) karena struktur data dan cara penggunaannya (referensi dari SoundSlot) identik antara Sample User dan Sample Template — hanya kepemilikan dan hak edit yang berbeda, sehingga tidak perlu duplikasi skema maupun query terpisah di sisi SoundSlot.

> **Catatan lama:** kolom `sound` (`CHECK IN ('T','D')`) dihapus dari `samples`. Jenis bunyi bukan lagi atribut tetap pada Sample — atribut itu kini melekat pada **SoundSlot** (Bagian 4.6a) yang *menggunakan* Sample tsb. Satu Sample cukup terikat ke `part`; keterkaitannya ke suatu jenis bunyi ditentukan saat dipasangkan ke SoundSlot.

**Index tambahan:** `(user_id, part)` — mempercepat query "daftar sample milik user untuk part tertentu". `(is_system_template, part)` — mempercepat query "daftar Sample Template untuk part tertentu", dipakai saat auto-isi SoundSlot default (FR-SLOT-09).

### 4.4 Tabel: `songs`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | |
| `user_id` | `BIGINT` | FK → `users.id`, **NULLABLE**, INDEX | `NULL` untuk Song Template System (milik System, bukan User manapun) — pola identik dengan `samples.user_id`, lihat Bagian 4.3 |
| `is_system_template` | `BOOLEAN` | NOT NULL, DEFAULT `false`, INDEX | *(baru)* `true` untuk Song Template System (PRD Bagian 10 keputusan #13) |
| `name` | `VARCHAR(255)` | NOT NULL | |
| `bpm` | `SMALLINT` | NOT NULL, CHECK (`bpm` BETWEEN 20 AND 400) | Batas wajar BPM musik (bukan pembatasan produk, murni sanity check teknis) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE, INDEX | Soft delete |

**Constraint tambahan (CHECK, level aplikasi + DB):** `user_id IS NULL` **jika dan hanya jika** `is_system_template = true` — pola identik dengan tabel `samples` (Bagian 4.3).

> **Perubahan dari rancangan sebelumnya:** `user_id` yang sebelumnya `NOT NULL` diubah menjadi **nullable**, dan ditambahkan kolom `is_system_template`, untuk mendukung **Song Template System** — Song bawaan platform yang dapat diakses tanpa login (Guest) untuk Launcher Mode dan Sequencer Mode read-only (PRD Bagian 10 keputusan #13–16). Pendekatan "satu tabel dengan flag" dipilih — konsisten dengan keputusan yang sama pada tabel `samples` — karena struktur data (Section, SectionPart, SoundSlot di bawahnya) identik antara Song User dan Song Template, hanya kepemilikan dan hak akses yang berbeda.

### 4.5 Tabel: `sections`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | |
| `song_id` | `BIGINT` | FK → `songs.id` ON DELETE CASCADE, NOT NULL, INDEX | |
| `name` | `VARCHAR(255)` | NOT NULL | Nama bebas, mis. "Awalan", "Naik 1" |
| `order_index` | `INTEGER` | NOT NULL | Urutan tampil dalam Song |
| `bpm_override` | `SMALLINT` | NULLABLE, CHECK (`bpm_override` BETWEEN 20 AND 400) | *(baru)* BPM khusus Section ini; jika `NULL`, Section mengikuti `songs.bpm` saat diputar (PRD Bagian 10 keputusan #8) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Index tambahan:** `(song_id, order_index)` — mempercepat query daftar section terurut per song.

> **Catatan cascade:** `ON DELETE CASCADE` pada `song_id` mengimplementasikan FR-SONG-04 (hapus Song menghapus seluruh Section) secara otomatis di level database, konsisten dengan NFR-08.

### 4.6 Tabel: `section_parts`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | |
| `section_id` | `BIGINT` | FK → `sections.id` ON DELETE CASCADE, NOT NULL, INDEX | |
| `part` | `VARCHAR(16)` | NOT NULL, CHECK IN (`rebana1`,`rebana2`,`rebana3`,`rebana4`,`bass`) | |
| `steps` | `TEXT` | NULLABLE | Rumus pukulan, panjang bebas tanpa batas (PRD Bagian 10 #2). Validasi karakter **tidak lagi berupa CHECK constraint statis** `^[TD]*$` — lihat catatan validasi dinamis di bawah |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Constraint unik:** `UNIQUE (section_id, part)` — mengunci aturan "1 Section selalu punya tepat 1 SectionPart per Part" di level database, bukan hanya di application layer.

> **Perubahan dari rancangan sebelumnya:** kolom `sample_tak_id` dan `sample_dung_id` **dihapus** dari tabel ini. Referensi ke Sample kini tidak langsung dari `section_parts`, melainkan lewat tabel baru `sound_slots` (Bagian 4.6a) — karena jumlah jenis bunyi per SectionPart sekarang dinamis, bukan tetap 2.

### 4.6a Tabel: `sound_slots` *(baru)*

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | |
| `section_part_id` | `BIGINT` | FK → `section_parts.id` ON DELETE CASCADE, NOT NULL, INDEX | |
| `label` | `VARCHAR(64)` | NOT NULL | Nama tampilan bebas, mis. "Tak", "Dung", "Duk" |
| `key` | `CHAR(1)` | NOT NULL | Karakter dipilih User, dipakai merepresentasikan bunyi ini dalam `steps` milik SectionPart yang sama |
| `sample_id` | `BIGINT` | FK → `samples.id` ON DELETE RESTRICT, NULLABLE | |
| `order_index` | `INTEGER` | NOT NULL, DEFAULT 0 | Urutan tampil SoundSlot dalam SectionPart (mis. di editor step) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Constraint unik:** `UNIQUE (section_part_id, key)` — mengunci FR-SLOT-02 (key unik dalam lingkup SectionPart yang sama) langsung di level database.

> **Catatan kunci — implementasi FR-SAMP-08 (versi baru):** `ON DELETE RESTRICT` pada `sample_id` membuat PostgreSQL otomatis menolak penghapusan baris `samples` selama masih direferensikan oleh `sound_slots` manapun — pola yang sama seperti rancangan sebelumnya, hanya berpindah lokasi FK dari `section_parts` ke `sound_slots`.

> **Catatan validasi dinamis — mengganti CHECK constraint statis:** Karena karakter valid dalam `steps` sekarang bergantung pada `key` milik SoundSlot yang terdaftar pada SectionPart yang sama (bukan lagi selalu `T`/`D`), validasi **"setiap karakter steps harus merujuk ke key SoundSlot yang ada"** (FR-SEQ-02) **tidak bisa** diimplementasikan sebagai CHECK constraint SQL sederhana (CHECK constraint tidak bisa query tabel lain). Validasi ini dipindahkan sepenuhnya ke **service layer** (Go), dijalankan setiap kali `steps` atau `sound_slots` suatu SectionPart diubah — lihat Bagian 7.

### 4.7 Ringkasan Relasi & Delete Behavior

| Relasi | On Delete | Mengimplementasikan |
|---|---|---|
| `sections.song_id → songs.id` | CASCADE | FR-SONG-04 |
| `section_parts.section_id → sections.id` | CASCADE | FR-SEC-05 |
| `sound_slots.section_part_id → section_parts.id` | CASCADE | Konsekuensi wajar penghapusan SectionPart — SoundSlot ikut terhapus |
| `sound_slots.sample_id → samples.id` | RESTRICT | FR-SAMP-08 |
| `samples.user_id → users.id` | RESTRICT (default) | Sample tidak boleh yatim; user harus dihapus lewat proses terpisah jika diperlukan (di luar cakupan MVP) |
| `songs.user_id → users.id` | RESTRICT (default) | idem |

---

## 5. Model GORM (Final)

```go
// model/base.go
type BaseModel struct {
    ID        uint           `gorm:"primaryKey" json:"id"`
    CreatedAt time.Time      `json:"created_at"`
    UpdatedAt time.Time      `json:"updated_at"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// model/part.go
type Part string

const (
    PartRebana1 Part = "rebana1"
    PartRebana2 Part = "rebana2"
    PartRebana3 Part = "rebana3"
    PartRebana4 Part = "rebana4"
    PartBass    Part = "bass"
)

var AllParts = []Part{PartRebana1, PartRebana2, PartRebana3, PartRebana4, PartBass}

// Catatan: type Sound (dulu enum tetap T/D) DIHAPUS dari model.
// Jenis bunyi kini direpresentasikan secara dinamis lewat SoundSlot.Label & SoundSlot.Key,
// bukan lagi konstanta tetap di kode — lihat PRD Bagian 10 keputusan #5.

// model/sample.go
type Sample struct {
    BaseModel
    UserID           *uint  `gorm:"index" json:"user_id"`                              // nullable — nil untuk Sample Template System
    IsSystemTemplate bool   `gorm:"not null;default:false;index" json:"is_system_template"` // true = Sample Template System (read-only bagi User)
    Name             string `gorm:"not null;size:255" json:"name"`
    ObjectKey        string `gorm:"not null;size:512" json:"-"` // tidak diekspos langsung ke JSON, lihat Bagian 6.6
    FileSizeBytes    int    `gorm:"not null" json:"file_size_bytes"`
    Part             Part   `gorm:"not null;size:16" json:"part"`
    // Field Sound (dulu T/D tetap) DIHAPUS — lihat catatan tabel samples, Bagian 4.3
}

// model/song.go
type Song struct {
    BaseModel
    UserID           *uint     `gorm:"index" json:"user_id"`                                    // nullable — nil untuk Song Template System
    IsSystemTemplate bool      `gorm:"not null;default:false;index" json:"is_system_template"` // true = Song Template System (read-only, dapat diakses Guest)
    Name             string    `gorm:"not null;size:255" json:"name"`
    Bpm              int16     `gorm:"not null" json:"bpm"`
    Sections         []Section `gorm:"foreignKey:SongID;constraint:OnDelete:CASCADE" json:"sections,omitempty"`
}

// model/section.go
type Section struct {
    BaseModel
    SongID      uint          `gorm:"not null;index" json:"song_id"`
    Name        string        `gorm:"not null;size:255" json:"name"`
    OrderIndex  int           `gorm:"not null" json:"order_index"`
    BpmOverride *int16        `json:"bpm_override"` // nullable — jika nil, ikut Song.Bpm saat playback (PRD Bagian 10 #8)
    Parts       []SectionPart `gorm:"foreignKey:SectionID;constraint:OnDelete:CASCADE" json:"parts,omitempty"`
}

// model/section_part.go
type SectionPart struct {
    BaseModel
    SectionID uint        `gorm:"not null;uniqueIndex:idx_section_part" json:"section_id"`
    Part      Part        `gorm:"not null;size:16;uniqueIndex:idx_section_part" json:"part"`
    Steps     *string     `gorm:"type:text" json:"steps"`
    SoundSlots []SoundSlot `gorm:"foreignKey:SectionPartID;constraint:OnDelete:CASCADE" json:"sound_slots,omitempty"`
}

// model/sound_slot.go — BARU, menggantikan SampleTakID/SampleDungID tetap
type SoundSlot struct {
    BaseModel
    SectionPartID uint    `gorm:"not null;uniqueIndex:idx_slot_key" json:"section_part_id"`
    Label         string  `gorm:"not null;size:64" json:"label"`
    Key           string  `gorm:"not null;size:1;uniqueIndex:idx_slot_key" json:"key"`
    SampleID      *uint   `gorm:"constraint:OnDelete:RESTRICT" json:"sample_id"`
    Sample        *Sample `gorm:"foreignKey:SampleID" json:"sample,omitempty"`
    OrderIndex    int     `gorm:"not null;default:0" json:"order_index"`
}
```

**Catatan implementasi:**
- `uniqueIndex:idx_section_part` pada `SectionID` + `Part` (SectionPart) merealisasikan constraint unik Bagian 4.6 langsung lewat tag GORM
- `uniqueIndex:idx_slot_key` pada `SectionPartID` + `Key` (SoundSlot) merealisasikan constraint unik Bagian 4.6a — mengimplementasikan FR-SLOT-02 (key unik dalam lingkup SectionPart yang sama)
- Validasi "setiap karakter `steps` merujuk ke `Key` SoundSlot yang terdaftar pada `SectionPart` yang sama" (FR-SEQ-02) **tidak bisa** direalisasikan sebagai CHECK constraint SQL statis, karena butuh query relasi antar tabel. Dilakukan sepenuhnya di **service layer** (Go) — lihat `service/section_part_service.go`, Bagian 10.1

---

## 6. Kontrak API (REST — Echo + Swagger)

Base path: `/api/v1`. Semua endpoint (kecuali auth) memerlukan header `Authorization: Bearer <JWT>`.

### 6.1 Auth

| Method | Endpoint | Deskripsi | FR Terkait |
|---|---|---|---|
| POST | `/auth/register` | Registrasi user baru | FR-AUTH-03 |
| POST | `/auth/login` | Login, mengembalikan JWT | FR-AUTH-01 |

### 6.2 Songs

| Method | Endpoint | Auth | Deskripsi | FR Terkait |
|---|---|---|---|---|
| GET | `/songs` | Wajib | Daftar Song milik user login | FR-SONG-05 |
| GET | `/songs/templates` | **Opsional** | Daftar Song Template System (`is_system_template = true`) — dapat diakses Guest maupun User login | FR-SONG-07, FR-SONG-09, FR-AUTH-04 |
| POST | `/songs` | Wajib | Buat Song baru (`name`, `bpm`), otomatis `user_id` = user login, `is_system_template` = false | FR-SONG-01, FR-SONG-02 |
| GET | `/songs/:id` | **Opsional*** | Detail Song beserta Section & SectionPart (nested). *Wajib login apabila Song target bukan Song Template System — lihat aturan akses di Bagian 6.8 | FR-SONG-05, FR-AUTH-04, FR-AUTH-05 |
| PUT | `/songs/:id` | Wajib | Update `name`/`bpm` — **ditolak (403)** apabila target adalah Song Template System | FR-SONG-03, FR-SONG-08 |
| DELETE | `/songs/:id` | Wajib | Hapus Song (cascade) — **ditolak (403)** apabila target adalah Song Template System | FR-SONG-04, FR-SONG-08 |
| POST | `/songs/:id/duplicate` | Wajib | Duplikasi Song beserta seluruh Section/SectionPart — berlaku untuk Song milik User maupun Song Template System (hasil duplikasi selalu menjadi milik User yang login, `is_system_template = false`) | FR-SONG-06, FR-SONG-10 |

### 6.3 Sections

| Method | Endpoint | Deskripsi | FR Terkait |
|---|---|---|---|
| POST | `/songs/:songId/sections` | Tambah Section baru (`name`) — backend otomatis membuat 5 SectionPart, masing-masing dengan SoundSlot default yang **langsung terpasang Sample Template System** (jika tersedia); `bpm_override` tidak diisi (default `null`, mengikuti BPM Song) | FR-SEC-01, FR-SEC-02, FR-SLOT-09 |
| PUT | `/sections/:id` | Update `name` dan/atau `bpm_override` (termasuk set `bpm_override` ke `null` untuk kembali mengikuti BPM Song) | FR-SEC-03, FR-SEC-08, FR-SEC-09 |
| PUT | `/sections/:id/reorder` | Update `order_index` (body: posisi baru) | FR-SEC-04 |
| DELETE | `/sections/:id` | Hapus Section (cascade ke SectionPart) | FR-SEC-05 |
| POST | `/sections/:id/duplicate` | Duplikasi Section dalam Song yang sama | FR-SEC-07 |

### 6.4 Section Parts (Sequencer)

| Method | Endpoint | Deskripsi | FR Terkait |
|---|---|---|---|
| GET | `/sections/:id/parts` | Daftar 5 SectionPart milik Section, beserta SoundSlots masing-masing (nested) | FR-SEQ-01 |
| PUT | `/section-parts/:id` | Update `steps` — divalidasi terhadap `key` SoundSlot yang terdaftar pada SectionPart tsb | FR-SEQ-01–04 |

> **Catatan desain endpoint:** SectionPart tidak memiliki endpoint `POST`/`DELETE` tersendiri — baris SectionPart selalu dibuat otomatis (5 sekaligus) saat Section dibuat, dan otomatis terhapus lewat cascade saat Section dihapus. Ini konsisten dengan aturan produk "1 Section selalu punya tepat 5 SectionPart".

### 6.5 Sound Slots *(baru)*

| Method | Endpoint | Deskripsi | FR Terkait |
|---|---|---|---|
| POST | `/section-parts/:id/sound-slots` | Tambah SoundSlot baru (`label`, `key`, opsional `sample_id`) — ditolak (400) jika `key` sudah dipakai SoundSlot lain pada SectionPart yang sama | FR-SLOT-01, FR-SLOT-02, FR-SLOT-03 |
| PUT | `/sound-slots/:id` | Update `label`, `key`, dan/atau `sample_id` (termasuk set `sample_id` ke null — mendukung FR-SAMP-10) | FR-SLOT-04, FR-SAMP-05, FR-SAMP-10 |
| DELETE | `/sound-slots/:id` | Hapus SoundSlot — lihat catatan penanganan `steps` terkait di bawah | FR-SLOT-05, FR-SLOT-06 |

> **Catatan implementasi FR-SLOT-09:** saat endpoint `POST /songs/:songId/sections` (Bagian 6.3) membuat 5 SectionPart otomatis, service layer sekaligus:
> 1. Membuat 2 SoundSlot default per SectionPart (`label: "Tak"`, `key: "T"` dan `label: "Dung"`, `key: "D"`) — bukan endpoint terpisah yang perlu dipanggil manual oleh client
> 2. Untuk masing-masing SoundSlot default tsb, mencari Sample Template System yang cocok (berdasarkan `part` SectionPart dan label bunyi — "Tak"/"Dung") lewat query ke tabel `samples` dengan filter `is_system_template = true`, lalu langsung mengisi `sample_id` SoundSlot tsb apabila ditemukan
> 3. Apabila Sample Template System untuk kombinasi part+bunyi tertentu tidak tersedia (mis. belum di-seed), SoundSlot tetap dibuat dengan `sample_id = NULL` — tidak menyebabkan error (konsisten dengan FR-SAMP-07)
>
> Logic pencarian & pemasangan Sample Template ini ditempatkan di `service/section_service.go` sebagai bagian dari proses pembuatan Section, bukan logic terpisah — lihat Bagian 10.1.

> **Penanganan hapus/ubah key SoundSlot yang masih dipakai di `steps` (FR-SLOT-06) — keputusan final:** `DELETE /sound-slots/:id` **ditolak (409 Conflict)** apabila `key` milik SoundSlot tsb masih muncul di dalam `steps` SectionPart terkait, dan `PUT /sound-slots/:id` yang mengubah `key` mengembalikan **400** apabila `key` lama masih dipakai di `steps` (User harus membersihkan step tsb terlebih dahulu). Pola ini konsisten dengan penanganan Sample (FR-SAMP-08) — lihat PRD Bagian 10 keputusan #7.

### 6.6 Samples

| Method | Endpoint | Deskripsi | FR Terkait |
|---|---|---|---|
| GET | `/samples` | Daftar Sample milik user yang login (filter opsional: `?part=`) | FR-SAMP-05 |
| GET | `/samples/templates` | Daftar Sample Template System (filter opsional: `?part=`) — dapat diakses oleh user manapun, terlepas dari kepemilikan Song/Section | FR-SAMP-11, FR-SAMP-13, FR-SAMP-14 |
| POST | `/samples` | Upload Sample baru milik user yang login (`multipart/form-data`: file, name, part) | FR-SAMP-01, FR-SAMP-02 |
| PUT | `/samples/:id` | Update `name` — **ditolak (403 Forbidden)** apabila target adalah Sample Template System (`is_system_template = true`) | FR-SAMP-09, FR-SAMP-12 |
| DELETE | `/samples/:id` | Hapus Sample milik user — **ditolak (409 Conflict)** jika masih direferensikan oleh SoundSlot manapun; **ditolak (403 Forbidden)** apabila target adalah Sample Template System | FR-SAMP-08, FR-SAMP-12 |
| GET | `/samples/:id/playback-url` | Menghasilkan **signed URL** sementara untuk memutar file audio dari object storage — berlaku sama untuk Sample milik user maupun Sample Template System | Mendukung FR-SEQ-05, FR-PLAY-02, FR-SAMP-13 |

> **Catatan implementasi FR-SAMP-12:** endpoint manajemen Sample Template System (create/update/delete) **tidak diekspos** lewat API publik pada Fase 1 — pengelolaan Sample Template dilakukan lewat **database seeder** (lihat Bagian 10.1, folder `seeders/`), bukan lewat endpoint yang dapat diakses User. Ini sekaligus merupakan cara paling sederhana untuk menjamin sifat read-only-nya: tidak ada endpoint yang bisa dipanggil User untuk mengubahnya sama sekali.

**Alur upload Sample (detail teknis AD-4):**
```
1. Client → POST /samples (multipart file + metadata: name, part)
2. Backend memvalidasi: format .wav (magic bytes, bukan hanya ekstensi), ukuran ≤5MB
3. Backend upload file ke object storage (key: samples/{userId}/{uuid}.wav)
4. Backend simpan object_key & file_size_bytes ke tabel samples (user_id = user yang login, is_system_template = false)
5. Response: metadata Sample (TANPA URL publik langsung — lihat poin berikut)
```

**Alur seeding Sample Template System (sekali jalan, bukan per-request):**
```
1. Tim/operator menjalankan seeder (mis. `go run seeders/sample_templates.go`)
2. Seeder membaca file .wav dari sumber lokal (audio yang sudah dimiliki), upload ke object storage
   (key: samples/system/{uuid}.wav — path terpisah dari samples/{userId}/, agar mudah dibedakan)
3. Seeder insert baris ke tabel samples dengan user_id = NULL, is_system_template = true
4. Sample Template System langsung tersedia untuk seluruh User lewat GET /samples/templates
```

**Alur playback Sample:**
```
1. Client (Sequencer/Launcher mode) butuh memutar sample tertentu (dari suatu SoundSlot)
2. Client → GET /samples/:id/playback-url
3. Backend generate signed URL (masa berlaku 60 menit) dari object storage
4. Client fetch audio langsung dari signed URL (bukan lewat backend) → efisien, tidak membebani server aplikasi
```

> **Alasan pakai signed URL, bukan URL publik permanen:** mencegah akses tak terautorisasi ke file audio milik user lain (selaras NFR-04), sekaligus menghindari backend jadi bottleneck streaming file besar berulang kali saat playback (yang bisa terjadi puluhan kali per menit dalam mode Launcher).

### 6.7 Response Error Standar

| HTTP Status | Kasus | Contoh |
|---|---|---|
| 400 | Validasi gagal (mis. karakter `steps` tidak merujuk ke `key` SoundSlot manapun pada SectionPart tsb; `key` SoundSlot duplikat dalam SectionPart yang sama) | FR-SEQ-02, FR-SLOT-02 |
| 401 | Token tidak valid/tidak ada, pada endpoint yang mewajibkan login | FR-AUTH-01 |
| 403 | Mengakses resource milik user lain; **atau** mencoba mengubah/menghapus Sample/Song Template System (`is_system_template = true`); **atau** Guest mencoba melakukan aksi apapun yang mengubah data | FR-AUTH-02, FR-AUTH-06, FR-SAMP-12, FR-SONG-08 |
| 404 | Resource tidak ditemukan; **atau** Guest mencoba mengakses Song milik User (bukan Song Template System) — dikembalikan sebagai 404, bukan 403, untuk tidak mengonfirmasi keberadaan resource ke pihak tak terautentikasi | FR-AUTH-05 |
| 409 | Hapus Sample yang masih direferensikan; **atau** hapus/ubah key SoundSlot yang masih dipakai di `steps` | FR-SAMP-08, FR-SLOT-06 |
| 413 | File upload melebihi 5MB | FR-SAMP-06 |
| 415 | Format file bukan `.wav` | FR-SAMP-06 |

### 6.8 Aturan Akses Guest *(baru)*

Merinci implementasi FR-AUTH-04–07 (PRD Bagian 10 keputusan #13–16) pada level endpoint.

**Matriks akses per peran:**

| Aksi | Guest (tanpa login) | User login |
|---|---|---|
| Lihat daftar Song Template System (`GET /songs/templates`) | ✅ Diizinkan | ✅ Diizinkan |
| Lihat detail + playback (Launcher Mode) Song Template System | ✅ Diizinkan | ✅ Diizinkan |
| Lihat Sequencer Mode Song Template System (read-only) | ✅ Diizinkan | ✅ Diizinkan |
| Lihat/akses Song milik User manapun | ❌ Ditolak (404) | ✅ Hanya milik sendiri (403 untuk milik user lain) |
| Buat/edit/hapus Song, Section, SectionPart, SoundSlot, Sample apapun | ❌ Ditolak (403) | ✅ Diizinkan (untuk resource miliknya) |
| Edit/hapus Song/Sample Template System | ❌ Ditolak (403) | ❌ Ditolak (403) — read-only bagi siapapun, lihat FR-SONG-08, FR-SAMP-12 |

**Implementasi middleware:**

```
Request masuk
  │
  ├── Endpoint wajib auth (semua POST/PUT/DELETE, GET /songs milik user)
  │     → middleware/auth.go → tolak 401 jika token tidak ada/tidak valid
  │
  └── Endpoint auth opsional (GET /songs/templates, GET /songs/:id, GET /samples/templates)
        → middleware/optional_auth.go
              → jika token ada & valid: set context user (untuk keperluan ownership check lanjutan)
              → jika token tidak ada: lanjutkan sebagai Guest (context user = nil), TIDAK menolak request
        → handler/service memutuskan izin akses berdasarkan kombinasi:
              (a) apakah resource target adalah is_system_template = true, DAN
              (b) apakah context user ada (login) atau nil (guest)
```

**Logic keputusan akses pada `GET /songs/:id` (contoh representatif):**

```go
// service/song_service.go (ilustratif)
func (s *SongService) GetByID(ctx context.Context, songID uint, currentUserID *uint) (*Song, error) {
    song, err := s.repo.FindByID(ctx, songID)
    if err != nil {
        return nil, err
    }

    if song.IsSystemTemplate {
        return song, nil // Guest maupun User, semua boleh lihat — FR-AUTH-04
    }

    if currentUserID == nil {
        return nil, ErrNotFound // Guest coba akses Song milik User → 404, bukan 403 — FR-AUTH-05
    }
    if song.UserID == nil || *song.UserID != *currentUserID {
        return nil, ErrForbidden // User login tapi bukan pemilik → 403 — FR-AUTH-02
    }
    return song, nil
}
```

> Pola yang sama (cek `IsSystemTemplate` lalu cek kepemilikan) diterapkan konsisten di seluruh service yang menangani resource bertingkat di bawah Song (Section, SectionPart, SoundSlot) — mewarisi status akses dari Song induknya, bukan dicek ulang per level secara independen.

---

## 7. Validasi (Detail per Field)

| Field | Aturan | Lapisan |
|---|---|---|
| `song.name` | Wajib, 1–255 karakter | Backend (`validate:"required,max=255"`) + Frontend |
| `song.bpm` | Wajib, integer 20–400 | Backend + Frontend |
| `section.bpm_override` | Opsional (nullable); jika diisi, integer 20–400 | Backend + Frontend |
| `section.name` | Wajib, 1–255 karakter | Backend + Frontend |
| `sound_slot.label` | Wajib, 1–64 karakter | Backend + Frontend |
| `sound_slot.key` | Wajib, tepat 1 karakter, **unik dalam lingkup SectionPart yang sama** (FR-SLOT-02) | Backend (custom validator, query SoundSlot lain pada SectionPart yang sama) + DB unique constraint (lapisan kedua) + Frontend (cek sebelum submit) |
| `section_part.steps` | Opsional; jika diisi, setiap karakter **harus merujuk ke `key` salah satu SoundSlot yang terdaftar pada SectionPart yang sama** (FR-SEQ-02), tanpa batas panjang | Backend (custom validator, query seluruh SoundSlot milik SectionPart tsb — **tidak bisa** berupa DB CHECK constraint statis karena butuh lintas tabel, lihat Bagian 4.6a) + Frontend (validasi terhadap daftar key yang sedang aktif, saat mengetik) |
| `sample.name` | Wajib, 1–255 karakter | Backend + Frontend |
| `sample.part` | Wajib, salah satu dari 5 enum Part | Backend (`validate:"oneof=rebana1 rebana2 rebana3 rebana4 bass"`) |
| Endpoint modifikasi Sample (`PUT`/`DELETE /samples/:id`) | Ditolak (403) apabila target Sample memiliki `is_system_template = true` (FR-SAMP-12) | Backend (middleware/service, cek flag sebelum proses update/delete) |
| File upload sample | Format `.wav` (dicek magic bytes via `gabriel-vasile/mimetype`), maks 5MB | Backend (wajib) + Frontend (pre-check untuk UX, bukan satu-satunya lapisan) |

> **Perubahan dari rancangan sebelumnya:** validasi `sample.sound` (`oneof=T D`) **dihapus** — atribut ini tidak lagi ada pada Sample. Validasi `steps` berubah signifikan: dari CHECK constraint statis sederhana (`^[TD]*$`) menjadi validasi dinamis lintas tabel di service layer, karena himpunan karakter valid sekarang bergantung pada data SoundSlot yang berbeda-beda per SectionPart.

---

## 8. Arsitektur Sistem (High-Level)

```
┌─────────────────┐      HTTPS/JSON       ┌──────────────────┐
│  apps/platform   │ ───────────────────►  │   apps/api        │
│  (React + TS)    │ ◄───────────────────  │   (Go + Echo)     │
│                   │                        │                  │
│  - TanStack       │                        │  Handler          │
│    Router/Query   │                        │    ↓              │
│  - Web Audio API  │                        │  Service          │
│    (playback,     │                        │    ↓              │
│    client-side)   │                        │  Repository       │
└─────────┬─────────┘                        └────────┬─────────┘
          │                                            │
          │  Signed URL (audio fetch langsung)         │  GORM
          │                                            ▼
          │                                   ┌──────────────────┐
          └──────────────────────────────────►│  Object Storage   │
                                               │  (S3-compatible)  │
                                               └──────────────────┘
                                                        
                                               ┌──────────────────┐
                                               │   PostgreSQL      │
                                               └──────────────────┘
```

**Poin kunci:**
- Frontend **tidak pernah** mengirim/menerima file audio melalui backend saat playback — hanya saat upload awal. Playback fetch langsung dari object storage via signed URL, menjaga backend tetap ringan (mendukung NFR-01 dan NFR-06)
- Web Audio API, Web Worker (lookahead scheduling), dan seluruh logic Pattern Launcher berjalan 100% di browser (AD-6) — backend murni berperan sebagai penyedia data terstruktur

---

## 9. Strategi Playback Engine (Client-Side, Detail Implementasi)

Mengadopsi teknik dari riset Kytaime (Dokumen Konsep Bagian 6.2), diadaptasi ke arsitektur frontend:

```
apps/platform/src/features/launcher/
├── engine/
│   ├── clock.worker.ts        ← Web Worker: interval timer independen dari main thread
│   ├── scheduler.ts            ← Lookahead scheduling (window ~200ms), jadwalkan ke Web Audio API
│   ├── section-player.ts       ← Logic quantized trigger/untrigger per Section
│   └── audio-buffer-cache.ts   ← Cache AudioBuffer hasil decode (in-memory, scope per sesi), hindari fetch/decode ulang saat re-trigger
├── components/
│   ├── LauncherGrid.tsx        ← Grid pad dinamis (1 pad per Section)
│   └── PlaybackIndicator.tsx   ← Indikator step & section aktif
└── hooks/
    └── useLauncherPlayback.ts  ← Hook orkestrasi state playback (React state ↔ engine)
```

**Alur singkat:**
1. Saat Song dibuka di mode Launcher, seluruh Sample yang direferensikan (lewat SoundSlot milik section-section-nya) di-*prefetch* & di-*decode* ke `AudioBuffer` lebih dulu (via signed URL), disimpan di `audio-buffer-cache` — menghindari latency decode saat pad ditekan
2. `clock.worker.ts` berjalan sebagai timer independen, mem-post message ke main thread tiap tick pendek
3. `scheduler.ts` menerima tick, menghitung step yang jatuh dalam window lookahead berikutnya; untuk tiap step aktif, mencocokkan karakternya dengan `key` SoundSlot yang bersangkutan pada SectionPart tsb untuk menentukan `AudioBuffer` mana yang diputar, lalu dijadwalkan ke `AudioContext` dengan timestamp presisi
4. `section-player.ts` menyimpan state Section mana yang `active` vs `pendingNext` — saat pad baru ditekan, tidak langsung switch, tapi menunggu `endBeat` dari siklus Section aktif tercapai (quantized trigger, FR-PLAY-04)
5. **Tempo aktif per Section (FR-PLAY-03, FR-PLAY-11):** `section-player.ts` menentukan BPM efektif setiap kali sebuah Section menjadi `active` — memakai `section.bpm_override` jika terisi, atau `song.bpm` jika `null`. Tepat saat transisi quantized trigger terjadi (Section lama berhenti, Section baru mulai), `scheduler.ts` langsung memakai BPM efektif Section baru untuk menghitung interval step berikutnya — **tanpa interpolasi/ramp** antara BPM lama dan baru (hard cut, sesuai keputusan produk). Karena perubahan BPM hanya diterapkan tepat di titik mulainya Section baru (bukan di tengah siklus Section yang sedang berjalan), pendekatan ini tidak menambah kompleksitas pada logic quantized trigger yang sudah ada di poin 4

> Detail lebih lanjut (kode konkret worker, exact scheduling math) akan disusun sebagai spesifikasi implementasi terpisah saat masuk sprint terkait modul Launcher — di luar cakupan level-desain TDD ini.

---

## 10. Struktur Kode (Mapping ke Template GOTS)

### 10.1 Backend

```
apps/api/
├── model/
│   ├── base.go, part.go, user.go, sample.go, song.go, section.go, section_part.go
│   └── sound_slot.go       ← BARU
├── dto/
│   ├── song_dto.go        (CreateSongRequest, UpdateSongRequest, SongResponse)
│   ├── section_dto.go
│   ├── section_part_dto.go
│   ├── sound_slot_dto.go  ← BARU (CreateSoundSlotRequest, UpdateSoundSlotRequest)
│   └── sample_dto.go
├── repository/
│   ├── song_repository.go, section_repository.go, section_part_repository.go, sample_repository.go
│   └── sound_slot_repository.go  ← BARU
├── service/
│   ├── song_service.go     ← DIPERLUAS: logic akses Guest vs User (IsSystemTemplate check) — lihat Bagian 6.8
│   ├── section_service.go     ← DIPERLUAS: saat create Section, cari & pasang Sample Template System ke SoundSlot default (FR-SLOT-09)
│   ├── section_part_service.go, sample_service.go   ← sample_service DIPERLUAS: proteksi 403 untuk modifikasi is_system_template=true (FR-SAMP-12)
│   ├── sound_slot_service.go   ← BARU — termasuk validasi key unik per SectionPart (FR-SLOT-02)
│   └── storage_service.go   ← abstraksi object storage (upload, signed URL)
├── handler/
│   ├── song_handler.go, section_handler.go, section_part_handler.go, sample_handler.go
│   └── sound_slot_handler.go   ← BARU
├── middleware/
│   ├── auth.go            ← JWT wajib — tolak 401 jika tidak ada/invalid
│   ├── optional_auth.go   ← BARU — set context user jika token ada & valid, lanjutkan sebagai Guest (context user = nil) jika tidak ada, TIDAK menolak request (AD-8, Bagian 6.8)
│   └── owner_check.go     (validasi kepemilikan resource — FR-AUTH-02)
├── utility/
│   ├── steps_validator.go    ← DIROMBAK: validasi dinamis terhadap key SoundSlot milik SectionPart terkait (query DB, bukan regex statis) — lihat Bagian 7
│   └── audio_validator.go    ← validasi magic bytes .wav via gabriel-vasile/mimetype
└── seeders/
    ├── sample_templates.go   ← script sekali-jalan untuk upload & insert Sample Template System (FR-SAMP-11), lihat alur seeding di Bagian 6.6
    └── song_templates.go     ← BARU — script sekali-jalan untuk insert Song Template System beserta Section/SectionPart/SoundSlot standar Al-Banjari (FR-SONG-07)
```

### 10.2 Frontend

```
apps/platform/src/
├── features/
│   ├── auth/
│   │   └── components/
│   │       └── LoginPromptInline.tsx   ← BARU: prompt "Login untuk edit" yang muncul inline di tempat aksi diklik (bukan redirect) — FR-AUTH-07
│   ├── song/           (list, create, edit, duplicate, delete)
│   │   └── components/
│   │       └── SongTemplateList.tsx    ← BARU: daftar Song Template System, dapat diakses tanpa login (FR-SONG-09)
│   ├── section/         (create, reorder, duplicate, delete; menampilkan BPM override — lihat Bagian 4.5)
│   ├── sequencer/        (step editor per SectionPart, preview audio)
│   │   └── components/
│   │       ├── SoundSlotManager.tsx   ← tambah/edit/hapus SoundSlot per SectionPart; DIPERLUAS: seluruh kontrol nonaktif/read-only + memicu LoginPromptInline saat diklik oleh Guest (FR-AUTH-06/07)
│   │       ├── SamplePicker.tsx       ← dropdown/modal pemilihan Sample, menampilkan dua kelompok terpisah "Sample Saya" vs "Sample Bawaan" (FR-SAMP-14)
│   │       └── StepGrid.tsx           ← grid step, jumlah baris = jumlah SoundSlot (dinamis); DIPERLUAS: mode read-only untuk Guest (step non-clickable, styling berbeda)
│   ├── sample/           (upload, library — menampilkan tab/section terpisah untuk Sample milik User vs Sample Template System, tombol edit/hapus disembunyikan untuk Sample Template)
│   └── launcher/          (lihat Bagian 9 — playback TIDAK dibatasi Guest untuk Song Template System, lihat matriks akses Bagian 6.8)
├── shared/
│   └── auth/
│       └── useCurrentUser.ts   ← BARU: hook membaca status login (user login vs Guest) dari context global, dipakai lintas fitur untuk menentukan apakah kontrol edit ditampilkan aktif atau read-only
├── api/
│   ├── endpoints/         ← auto-generated (Orval) dari Swagger
│   └── model/              ← auto-generated types
```

---

## 11. Cakupan Testing

| Level | Fokus | Contoh |
|---|---|---|
| Unit Test (Backend) | Service layer: validasi steps, aturan RESTRICT sample, business logic duplicate | `steps` dengan karakter selain T/D ditolak; hapus sample yang direferensikan mengembalikan error |
| Unit Test (Frontend) | Playback engine: scheduling math, quantized trigger logic | Simulasi trigger Section baru di tengah siklus tidak memotong paksa |
| Integration Test | Endpoint API end-to-end dengan DB test | Cascade delete Song menghapus seluruh Section & SectionPart |
| Manual/Exploratory | UX playback di perangkat sentuh (tablet) | Sesuai NFR-07 |

Mapping detail ke tiap Acceptance Criteria PRD (AC-1 s.d. AC-12) akan disusun sebagai Test Plan terpisah pada tahap QA.

---

## 12. Hal yang Masih Perlu Diputuskan (Sprint Planning / Implementasi)

Seluruh butir teknis granular yang sebelumnya tercatat di bagian ini telah difinalisasi, termasuk butir baru menyusul perubahan model SoundSlot. Daftar di bawah dipertahankan sebagai catatan riwayat keputusan.

> **Keputusan yang sudah dikunci:**
> - Provider object storage: **Cloudflare R2** untuk produksi, **MinIO** untuk environment development — dipilih karena API S3-compatible (kompatibel langsung dengan pola signed URL di Bagian 6.6 tanpa penyesuaian), zero egress fee (signifikan untuk pola akses BandJari yang sering fetch berulang saat playback Launcher), dan risiko vendor lock-in rendah. Cloudinary dipertimbangkan namun tidak dipilih karena diferensiasi utamanya (transformasi media on-the-fly) tidak relevan untuk kebutuhan BandJari (file `.wav` diputar apa adanya, tanpa transformasi) — lihat Bagian 3 (AD-4)
> - Masa berlaku signed URL **60 menit** — lihat Bagian 6.6
> - Library validasi magic bytes file `.wav`: **`gabriel-vasile/mimetype`** — lihat Bagian 7 & 10.1
> - Strategi caching `AudioBuffer`: **in-memory** (`Map<sampleId, AudioBuffer>` di modul `audio-buffer-cache.ts`, dikonsumsi lewat hook `useLauncherPlayback` — lihat Bagian 9) — dipilih karena skala data per Song di MVP kecil (maks 5 SectionPart × jumlah Section, tiap file sample ≤5MB), dan prefetch sudah terjadi saat Song dibuka sehingga cache lintas-sesi (IndexedDB) belum memberi manfaat berarti untuk cakupan Fase 1. Cache hilang saat refresh browser bukan masalah — signed URL (berlaku 60 menit) memungkinkan fetch ulang tanpa hambatan. IndexedDB dapat dipertimbangkan kembali jika ke depan ada kebutuhan mode offline atau Song berskala sangat besar
> - **Penanganan hapus/ubah key SoundSlot yang masih dipakai di `steps`** (FR-SLOT-06): **tolak** — konsisten dengan pola FR-SAMP-08. Lihat Bagian 6.5 dan PRD Bagian 10 keputusan #7

---

## 13. Referensi

- PRD: `PRD-bandjari.md`
- BRD: `BRD-bandjari.md`
- Dokumen Konsep (riset Kytaime, domain knowledge): `bandjari-konsep.md`
- GOTS Monorepo Starter Kit: [github.com/anasMuf/monorepo_gots_starterkit](https://github.com/anasMuf/monorepo_gots_starterkit)
- Kytaime Throwdown (referensi playback engine): [github.com/haszari/kytaime](https://github.com/haszari/kytaime)
