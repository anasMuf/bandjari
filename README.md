# 🥁 BandJari

**Penyusun & pemutar pola pukulan rebana Al-Banjari** — web app untuk menyusun pola pukulan (steps) 4 rebana + 1 bass per *Section*, dan memainkannya live lewat *Pattern Launcher*.

> Fase 1 (MVP) — status: fitur inti selesai & teruji. Detail produk & teknis ada di [`docs/core/`](docs/core/).

---

## Fitur Utama

- **Manajemen Song & Section dinamis** — section bebas nama & jumlah; tiap section punya 5 part (rebana1–4, bass), BPM override opsional, perilaku **Diulang / Sekali**, dan **tujuan lanjut** (`berikutnya` / `section terpilih` / `Ending`).
- **Sequencer Mode** — grid step dengan multi-bunyi per kolom (`T+D`), langkah istirahat (`.`), kelipatan 4 kolom per ketukan, mute per part, bersihkan step per part, dan preview audio real-time.
- **SoundSlot & Library Sample** — jenis bunyi dinamis per part (key 1–2 karakter), bulk upload `.wav`, proteksi hapus sample yang masih dipakai.
- **Launcher Mode** — grid pad dinamis, quantized trigger antar section, hard cut BPM, mute per part, auto-lanjut section "sekali", transport Play/Pause/Stop, **kontrol BPM Song temporary realtime** (±1/±5 + reset; section dengan BPM override ikut terskala proporsional), dan **Antrian Section** opsional: tombol + di pojok tiap pad mengaktifkan **Mode Antrian** (badge nomor urut, panel antrian dengan drag-drop reorder, jumlah loop per baris, tujuan lanjut otomatis masuk antrian, queue-first di tiap akhir siklus); antrian dikosongkan (hapus/bersihkan) → kembali ke **Mode Biasa** pra-antrian (pending single-slot).
- **Playback engine 100% client-side** — Web Worker + lookahead scheduling berbasis AudioContext; 1 step = 1/16 ketukan (`60000/bpm/4` ms).
- **Template System** — Song & Sample template bisa dimainkan Guest, diduplikasi ke "Song Saya", dan dikelola **admin**.
- **Role admin/user** — admin boleh mengelola (buat/edit/hapus) Song Template System & Sample Template System; role dibaca dari DB per-request sehingga perubahan langsung berlaku.

---

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Backend | Go + Echo v4, GORM + PostgreSQL, Swagger (swaggo), JWT (`golang-jwt`), Logrus |
| Frontend | React 19 + TypeScript, Vite, TanStack Router & Query, Tailwind CSS v4, Biome, Orval |
| Object Storage | S3-compatible — MinIO (dev) / Cloudflare R2 (prod) |
| Monorepo | pnpm workspaces + Nx |

---

## Struktur Repo

```
bandjari/
├── apps/
│   ├── api/            ← Go REST API (Echo + GORM + PostgreSQL)
│   │   ├── config/     ← ENV, koneksi DB, storage
│   │   ├── model/      ← GORM entities (User, Song, Section, SectionPart, SoundSlot, Sample)
│   │   ├── dto/        ← Request/Response DTOs
│   │   ├── repository/ ← Data access layer
│   │   ├── service/    ← Business logic + access guard (access.go)
│   │   ├── handler/    ← HTTP handlers
│   │   ├── middleware/ ← JWT (role dari DB), OptionalAuth, logging
│   │   ├── utility/    ← Validator steps/key/wav, JWT claims
│   │   ├── seeders/    ← sample_templates & song_templates
│   │   └── docs/       ← Swagger (auto-generated)
│   └── platform/       ← React SPA
│       └── src/
│           ├── routes/                 ← TanStack Router (file-based)
│           ├── features/               ← auth, song, section, sequencer, sample, launcher
│           │   └── launcher/engine/    ← scheduler, section-player, audio cache
│           ├── components/             ← atoms & molecules (Button, Badge, Toast, ...)
│           ├── lib/                    ← steps codec (shared sequencer ↔ launcher)
│           └── api/                    ← Orval generated hooks & types
├── docs/
│   ├── core/           ← BRD, PRD, TDD, Epic Breakdown, Wireframe
│   └── src/            ← file .wav sampling (SAMPLING HADRAH AB CHANNEL)
├── tasks/              ← plan.md & todo.md (perencanaan pengerjaan)
├── docker-compose.yml  ← MinIO + minio-init (bucket otomatis)
├── nx.json
├── pnpm-workspace.yaml
└── .env                ← konfigurasi environment (tidak di-commit)
```

---

## Prasyarat

- **Node.js** ≥ 20 & **pnpm** ≥ 9
- **Go** ≥ 1.25
- **PostgreSQL** ≥ 15
- **Docker** (untuk MinIO object storage)

---

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Setup environment

Salin `.env.example` ke `.env` lalu sesuaikan:

```env
# API
PORT=8080
JWT_SECRET=bandjari-dev-secret-2026

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=bandjari
SSL_MODE=disable

# Object Storage (MinIO dev / Cloudflare R2 prod)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_BUCKET=bandjari-samples
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin
STORAGE_USE_PATH_STYLE=true

# Frontend
VITE_API_URL=http://localhost:8080/api/v1
```

### 3. Database & object storage

```bash
createdb bandjari
docker compose up -d          # MinIO + buat bucket bandjari-samples
```

> Tabel dibuat otomatis oleh GORM AutoMigrate saat API pertama kali dijalankan.
> Console MinIO: http://localhost:9001 (user/pass `minioadmin`).

### 4. Seed data (opsional tapi disarankan)

```bash
cd apps/api

# 13 sample template sistem (butuh MinIO aktif + folder docs/src/SAMPLING HADRAH AB CHANNEL)
go run ./seeders/sample_templates

# Song template "Standar Banjari (Template)" — 8 section asli (awalan → tutup)
go run ./seeders/song_templates
```

Seeder bersifat idempotent — aman dijalankan ulang.

### 5. Jalankan development

```bash
pnpm dev                 # semua apps (API :8080 + Platform :3000)
```

atau terpisah:

```bash
pnpm --filter api dev           # API dengan hot-reload (Air)
pnpm --filter platform dev      # Frontend dev server (port 3000)
```

Swagger UI tersedia di: **http://localhost:8080/swagger/index.html**

---

## Role Admin

User default ber-role `user`. Penugasan admin dilakukan manual via database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'anas@bandjari.com';
```

Hak admin:

- Buat **Song Template System** (checkbox di form buat lagu) & kelola penuh (section, steps, sound slot).
- Upload/rename/hapus **Sample Template System** (checkbox di form upload sample).
- Halaman template menampilkan **Mode Admin** yang bisa diedit.
- **Set status public/private lagu miliknya sendiri** (FR-VIS) — kontrol di form buat & edit lagu, hanya tampil untuk admin. Lagu **public** tampil di Explore beserta nama penulis; **private** (default) hanya untuk pemiliknya. Admin tidak bisa mengubah status lagu milik user lain.

Role dibaca dari database pada **setiap request** (middleware JWT), sehingga promosi/demosi berlaku seketika — tidak perlu menunggu token kedaluwarsa. Non-admin tetap tidak bisa menyentuh template (403), dan aturan kepemilikan data pribadi tidak berubah.

---

## Scripts

| Command | Deskripsi |
|---|---|
| `pnpm dev` | Jalankan semua apps (nx) |
| `pnpm build` | Build semua apps (nx) |
| `pnpm --filter platform test` | Vitest — engine playback, steps codec, dll |
| `pnpm --filter platform lint` | Biome lint |
| `cd apps/api && go test ./...` | Seluruh tes backend (service, middleware, utility) |
| `cd apps/api && go build ./...` | Build backend |
| `cd apps/api && go run github.com/swaggo/swag/cmd/swag init -g main.go` | Regenerate Swagger |
| `pnpm --filter platform generate:api` | Orval: Swagger → React Query hooks |

> Setelah mengubah DTO/handler backend: regenerate Swagger **lalu** Orval (`generate:api`) agar kontrak klien sinkron.

---

## Ringkasan API (prefix `/api/v1`)

| Area | Endpoint |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /users` |
| Songs | `GET/POST /songs`, `GET /songs/templates`, `GET /songs/public`, `GET/PUT/DELETE /songs/:id`, `PUT /songs/:id/visibility`, `POST /songs/:id/duplicate` |
| Sections | `POST /songs/:songId/sections`, `PUT/DELETE /sections/:id`, `PUT /sections/:id/reorder`, `POST /sections/:id/duplicate` |
| Sequencer | `GET /sections/:id/parts`, `PUT /section-parts/:id`, `POST /section-parts/:id/sound-slots`, `PUT/DELETE /sound-slots/:id` |
| Samples | `GET/POST /samples`, `GET /samples/templates`, `PUT/DELETE /samples/:id`, `GET /samples/:id/playback-url` |

Format respons standar: `{ "message": string, "data": ... }`. Detail kontrak & aturan akses: [`docs/core/tdd.md`](docs/core/tdd.md).

---

## Dokumentasi Produk

| Dokumen | Isi |
|---|---|
| [`docs/core/brd.md`](docs/core/brd.md) | Business Requirements |
| [`docs/core/prd.md`](docs/core/prd.md) | Product Requirements (alur, FR, acceptance criteria) |
| [`docs/core/tdd.md`](docs/core/tdd.md) | Technical Design (skema DB, kontrak API, playback engine, role FR-ROLE) |
| [`docs/core/breakdown.md`](docs/core/breakdown.md) | Epic & user story breakdown |
| [`docs/core/wireframe.html`](docs/core/wireframe.html) | Wireframe layar aplikasi |

---

## License

ISC
