# Epic & User Story Breakdown
## BandJari — Fase 1 (MVP)

| | |
|---|---|
| **Dokumen** | Epic & User Story Breakdown |
| **Produk** | BandJari |
| **Cakupan** | Fase 1 / MVP — turunan langsung dari PRD & TDD |
| **Versi** | 1.0 |
| **Status** | Draft — siap untuk Sprint Planning |
| **Dokumen Terkait** | [PRD](./PRD-bandjari.md) · [TDD](./TDD-bandjari.md) |

> *"BandJari" — bermain musik selayaknya sebuah band, cukup dengan jari.*

---

## 1. Cara Membaca Dokumen Ini

- **Epic** = kumpulan besar pekerjaan yang mewakili satu modul/kapabilitas produk (biasanya 1 Epic ≈ 1 modul FR di PRD)
- **User Story** = kebutuhan dari sudut pandang pengguna, format *"Sebagai [peran], saya bisa [aksi], agar [tujuan]"*
- **Task** = pekerjaan teknis konkret untuk merealisasikan satu Story — dipecah per layer (Backend/Frontend) mengikuti struktur kode di TDD Bagian 10
- Setiap Story mencantumkan **FR Terkait** (mapping ke PRD) dan **Prioritas** (mewarisi MoSCoW dari FR-nya)
- **Estimasi** memakai T-shirt size (S/M/L/XL) — bukan story point angka, karena tim belum punya baseline velocity. Bisa dikonversi ke poin saat sprint planning pertama berjalan
- Epic diurutkan mengikuti **urutan dependency teknis** (fondasi → fitur), bukan urutan modul di PRD

---

## 2. Peta Epic

| # | Epic | Modul FR Terkait | Alasan Urutan |
|---|---|---|---|
| E0 | Fondasi Proyek & Infrastruktur | AD-1–8 (TDD) | Prasyarat teknis — tanpa ini, tidak ada Epic lain yang bisa mulai |
| E1 | Autentikasi & Akses Guest | FR-AUTH-01–07 | Menentukan siapa bisa apa — Epic lain bergantung pada middleware ini |
| E2 | Manajemen Song | FR-SONG-01–10 | Entity paling atas — Section/SectionPart tidak bisa dibuat tanpa Song |
| E3 | Manajemen Section & BPM Override | FR-SEC-01–09 | Bergantung pada E2 |
| E4 | Manajemen Sample Audio | FR-SAMP-01–14 | Independen dari Section, tapi dibutuhkan sebelum SoundSlot bisa diisi bermakna |
| E5 | SoundSlot & Sequencer | FR-SLOT-01–09, FR-SEQ-01–06 | Bergantung pada E3 (SectionPart) dan E4 (Sample) |
| E6 | Song & Sample Template System | FR-SONG-07–10, FR-SAMP-11–14 | Bergantung pada E2–E5 selesai (butuh skema lengkap sebelum di-seed) |
| E7 | Pattern Launcher (Playback) | FR-PLAY-01–11 | Konsumen akhir dari seluruh data E2–E6 |

---

## Epic E0 — Fondasi Proyek & Infrastruktur

**Tujuan:** Menyiapkan kerangka teknis (monorepo, database, auth dasar, object storage) sebelum fitur produk apapun bisa dibangun. Tidak menghasilkan user-facing feature, tapi prasyarat mutlak.

**FR Terkait:** TDD Bagian 3 (AD-1 s.d. AD-8), Bagian 4 (skema DB)

### Story E0-1: Setup Monorepo
**Sebagai** developer, **saya bisa** menjalankan `apps/api` dan `apps/platform` dalam satu monorepo pnpm+Nx, **agar** development kedua sisi terkoordinasi dari awal.

| Task | Layer | Estimasi |
|---|---|---|
| Inisialisasi struktur monorepo mengikuti template GOTS | Infra | S |
| Setup pnpm workspace + konfigurasi Nx | Infra | S |
| Setup CI dasar (lint + build check) | Infra | M |

### Story E0-2: Setup Database & Migration
**Sebagai** developer, **saya bisa** menjalankan migration PostgreSQL untuk seluruh skema TDD Bagian 4, **agar** entity dasar (users, songs, sections, section_parts, sound_slots, samples) siap dipakai.

| Task | Layer | Estimasi |
|---|---|---|
| Setup koneksi GORM + PostgreSQL (`config/`) | Backend | S |
| Buat model GORM: `User`, `Sample`, `Song`, `Section`, `SectionPart`, `SoundSlot` (TDD Bagian 5) | Backend | M |
| Migration awal + constraint (unique, FK, CHECK) sesuai TDD Bagian 4 | Backend | M |
| Verifikasi `ON DELETE RESTRICT`/`CASCADE` bekerja sesuai Bagian 4.7 | Backend | S |

### Story E0-3: Setup Object Storage
**Sebagai** developer, **saya bisa** upload & fetch file lewat object storage S3-compatible, **agar** fitur Sample audio (E4) punya fondasi penyimpanan.

| Task | Layer | Estimasi |
|---|---|---|
| Setup MinIO untuk environment development | Infra | S |
| Implementasi `service/storage_service.go` (upload, generate signed URL 60 menit) | Backend | M |
| Setup kredensial Cloudflare R2 untuk staging/produksi (AD-4) | Infra | S |

### Story E0-4: Setup API Contract Pipeline
**Sebagai** developer frontend, **saya bisa** memakai React Query hooks yang otomatis ter-generate dari Swagger backend, **agar** tidak perlu menulis fetch/tipe manual.

| Task | Layer | Estimasi |
|---|---|---|
| Setup Swagger annotation dasar di Echo (`docs/`) | Backend | S |
| Setup Orval config di frontend, uji generate dari 1 endpoint dummy | Frontend | S |

---

## Epic E1 — Autentikasi & Akses Guest

**Tujuan:** Middleware auth (wajib & opsional) dan aturan akses Guest vs User, karena seluruh Epic berikutnya bergantung pada ini untuk menentukan siapa boleh mengakses/mengubah apa.

**FR Terkait:** FR-AUTH-01–07 | **TDD Terkait:** AD-8, Bagian 6.8

### Story E1-1: Registrasi & Login
**Sebagai** pengunjung, **saya bisa** mendaftar dan login dengan email/password, **agar** saya bisa membuat dan mengedit Song saya sendiri.

*FR: FR-AUTH-01, FR-AUTH-03*

| Task | Layer | Estimasi |
|---|---|---|
| Endpoint `POST /auth/register`, `POST /auth/login` (JWT) | Backend | M |
| Halaman/form Login & Register | Frontend | M |
| Hook `useCurrentUser.ts` (baca status login dari context global) | Frontend | S |

### Story E1-2: Middleware Auth Wajib & Opsional
**Sebagai** sistem, **saya perlu** membedakan endpoint yang wajib login dari yang boleh diakses Guest, **agar** aturan akses FR-AUTH-04–07 bisa ditegakkan konsisten di semua endpoint.

*FR: FR-AUTH-01, FR-AUTH-04, FR-AUTH-05, FR-AUTH-06*

| Task | Layer | Estimasi |
|---|---|---|
| `middleware/auth.go` — tolak 401 jika token tidak ada/invalid | Backend | S |
| `middleware/optional_auth.go` — set context user jika ada token, lanjut sebagai Guest jika tidak (AD-8) | Backend | M |
| `middleware/owner_check.go` — validasi kepemilikan resource (403 jika bukan pemilik) | Backend | M |

### Story E1-3: Prompt Login Inline untuk Guest
**Sebagai** Guest, **saya bisa** melihat prompt "Login untuk edit" tepat di tempat saya mencoba mengedit, **agar** saya tidak dilempar paksa ke halaman lain saat sedang menjelajah.

*FR: FR-AUTH-07*

| Task | Layer | Estimasi |
|---|---|---|
| Komponen `LoginPromptInline.tsx` (modal/inline, bukan redirect) | Frontend | M |
| Terapkan ke seluruh titik aksi guest-terbatas (akan dipakai ulang oleh E3, E4, E5) | Frontend | S |

---

## Epic E2 — Manajemen Song

**Tujuan:** CRUD Song milik User — entity paling atas dalam hierarki data.

**FR Terkait:** FR-SONG-01–06 (Template System sebagai FR-SONG-07–10 dipisah ke Epic E6)

### Story E2-1: Membuat & Melihat Daftar Song
**Sebagai** User, **saya bisa** membuat Song baru dan melihat daftar Song saya, **agar** saya punya tempat mulai menyusun pattern.

*FR: FR-SONG-01, FR-SONG-02, FR-SONG-05*

| Task | Layer | Estimasi |
|---|---|---|
| `POST /songs`, `GET /songs` (Wajib login) | Backend | S |
| `dto/song_dto.go` (CreateSongRequest, SongResponse) | Backend | S |
| Halaman Daftar Song + state kosong ("belum ada Song") | Frontend | M |
| Form "Buat Song Baru" (nama, BPM) | Frontend | S |

### Story E2-2: Mengedit & Menghapus Song
**Sebagai** User, **saya bisa** mengubah nama/BPM Song atau menghapusnya, **agar** saya bisa mengelola Song yang sudah dibuat.

*FR: FR-SONG-03, FR-SONG-04*

| Task | Layer | Estimasi |
|---|---|---|
| `PUT /songs/:id`, `DELETE /songs/:id` (cascade ke Section) | Backend | S |
| Verifikasi cascade delete konsisten dengan NFR-08 | Backend | S |
| UI edit nama/BPM Song, konfirmasi hapus | Frontend | S |

### Story E2-3: Duplikasi Song
**Sebagai** User, **saya bisa** menduplikasi Song yang sudah ada, **agar** saya punya starting point cepat untuk variasi baru tanpa menyusun dari nol.

*FR: FR-SONG-06*

| Task | Layer | Estimasi |
|---|---|---|
| `POST /songs/:id/duplicate` — deep copy Section/SectionPart/SoundSlot | Backend | M |
| Tombol "Duplikasi" di daftar Song | Frontend | S |

---

## Epic E3 — Manajemen Section & BPM Override

**Tujuan:** Section dinamis di dalam Song, termasuk tempo per-Section.

**FR Terkait:** FR-SEC-01–09

### Story E3-1: Menambah Section (Auto-buat 5 SectionPart)
**Sebagai** User, **saya bisa** menambah Section baru dengan nama bebas, **agar** saya bisa menyusun bagian lagu (Awalan, Dasar, Naik, dst) sesuai kreativitas saya sendiri.

*FR: FR-SEC-01, FR-SEC-02, FR-SEC-06*

> **Catatan dependency:** Task backend di Story ini juga menyentuh pembuatan SoundSlot default berisi Sample Template (FR-SLOT-09) — lihat catatan silang di Story E5-1. Diimplementasikan bersamaan agar `POST /sections` langsung menghasilkan Section yang siap didengar, tapi Sample Template baru tersedia setelah Epic E6 (seeding) selesai — sebelum itu, SoundSlot default dibuat kosong tanpa error (fallback aman).

| Task | Layer | Estimasi |
|---|---|---|
| `POST /songs/:songId/sections` — auto-buat 5 SectionPart | Backend | M |
| `dto/section_dto.go` | Backend | S |
| Komponen Section strip (chip horizontal, tombol "+ Tambah Section") | Frontend | M |

### Story E3-2: Mengedit, Reorder, Menghapus Section
**Sebagai** User, **saya bisa** mengubah nama, mengatur ulang urutan, atau menghapus Section, **agar** susunan lagu saya fleksibel mengikuti aransemen yang saya inginkan.

*FR: FR-SEC-03, FR-SEC-04, FR-SEC-05*

| Task | Layer | Estimasi |
|---|---|---|
| `PUT /sections/:id`, `PUT /sections/:id/reorder`, `DELETE /sections/:id` | Backend | M |
| Drag-and-drop reorder Section (chip strip) | Frontend | M |
| Konfirmasi hapus Section (cascade ke SectionPart) | Frontend | S |

### Story E3-3: Duplikasi Section
**Sebagai** User, **saya bisa** menduplikasi Section dalam Song yang sama, **agar** saya punya starting point untuk variasi (mis. "Naik 2" dari "Naik 1").

*FR: FR-SEC-07*

| Task | Layer | Estimasi |
|---|---|---|
| `POST /sections/:id/duplicate` | Backend | S |
| Tombol "Duplikasi Section" | Frontend | S |

### Story E3-4: BPM Override per Section
**Sebagai** User, **saya bisa** menetapkan tempo khusus untuk satu Section, **agar** bagian "Dasar Lambat" bisa lebih lambat dan "Naik" bisa lebih cepat dari BPM dasar Song.

*FR: FR-SEC-08, FR-SEC-09*

| Task | Layer | Estimasi |
|---|---|---|
| Kolom `bpm_override` sudah ada di migration E0 — tambah validasi 20–400 di `PUT /sections/:id` | Backend | S |
| Input BPM override (boleh kosong) di panel Section | Frontend | S |
| Badge BPM di tiap chip Section, tandai visual jika override aktif (★) | Frontend | S |

---

## Epic E4 — Manajemen Sample Audio

**Tujuan:** Upload, kelola, dan reuse file audio milik User. Independen dari Section/SoundSlot secara struktur data, tapi harus ada sebelum SoundSlot (E5) bisa diisi bermakna.

**FR Terkait:** FR-SAMP-01–10 (Template System sebagai FR-SAMP-11–14 dipisah ke Epic E6)

### Story E4-1: Upload Sample
**Sebagai** User, **saya bisa** mengunggah file audio `.wav` sebagai Sample, **agar** saya punya bunyi asli untuk dipasangkan ke pola pukulan saya.

*FR: FR-SAMP-01, FR-SAMP-02, FR-SAMP-03, FR-SAMP-06*

| Task | Layer | Estimasi |
|---|---|---|
| Integrasi `gabriel-vasile/mimetype` untuk validasi magic bytes `.wav` (`utility/audio_validator.go`) | Backend | S |
| `POST /samples` (multipart, validasi ≤5MB, upload ke object storage) | Backend | M |
| Form upload Sample (nama, Part, file picker dengan pre-check klien) | Frontend | M |

### Story E4-2: Melihat & Mengelola Library Sample
**Sebagai** User, **saya bisa** melihat daftar Sample saya, mengganti nama, atau menghapusnya, **agar** library saya tetap rapi.

*FR: FR-SAMP-05, FR-SAMP-09*

| Task | Layer | Estimasi |
|---|---|---|
| `GET /samples` (filter `?part=`), `PUT /samples/:id` | Backend | S |
| Halaman Library Sample (grid card, filter Part) | Frontend | M |

### Story E4-3: Proteksi Hapus Sample yang Masih Dipakai
**Sebagai** sistem, **saya perlu** menolak penghapusan Sample yang masih direferensikan SoundSlot, **agar** data pattern yang sudah disusun User tidak rusak tiba-tiba.

*FR: FR-SAMP-08, FR-SAMP-10*

| Task | Layer | Estimasi |
|---|---|---|
| `DELETE /samples/:id` — cek referensi SoundSlot, kembalikan 409 jika masih dipakai (mengandalkan `ON DELETE RESTRICT` dari E0) | Backend | S |
| UI pesan error 409 yang jelas + link ke SoundSlot terkait | Frontend | M |

### Story E4-4: Playback Sample via Signed URL
**Sebagai** User, **saya bisa** mendengar preview Sample sebelum memakainya, **agar** saya yakin bunyinya sesuai sebelum dipasang ke pattern.

*FR: mendukung FR-SEQ-05, FR-PLAY-02*

| Task | Layer | Estimasi |
|---|---|---|
| `GET /samples/:id/playback-url` (signed URL 60 menit) | Backend | S |
| Tombol preview (▶) dengan fetch signed URL + Web Audio play sekali | Frontend | M |

---

## Epic E5 — SoundSlot & Sequencer

**Tujuan:** Jantung dari fitur penyusunan pola pukulan — SoundSlot dinamis dan step editor.

**FR Terkait:** FR-SLOT-01–09, FR-SEQ-01–06

### Story E5-1: Menambah & Mengelola SoundSlot
**Sebagai** User, **saya bisa** menambah jenis bunyi (SoundSlot) pada suatu SectionPart dengan label dan key bebas, **agar** saya bisa merepresentasikan dinamika pukulan yang lebih dari sekadar Tak/Dung (mis. tambahan "Duk").

*FR: FR-SLOT-01, FR-SLOT-02, FR-SLOT-03, FR-SLOT-04, FR-SLOT-09*

| Task | Layer | Estimasi |
|---|---|---|
| `POST /section-parts/:id/sound-slots`, `PUT /sound-slots/:id` | Backend | M |
| Validasi key unik per SectionPart (`service/sound_slot_service.go`) | Backend | S |
| Logic auto-buat 2 SoundSlot default + coba pasang Sample Template saat Section dibuat (bagian dari E3-1, diimplementasikan di sini karena menyentuh `sound_slot_service.go`) | Backend | M |
| Komponen `SoundSlotManager.tsx` (tabel Label/Key/Sample per Part) | Frontend | M |
| Form "+ Tambah Bunyi" (label + key input) | Frontend | S |

### Story E5-2: Menghapus SoundSlot dengan Proteksi
**Sebagai** sistem, **saya perlu** menolak penghapusan/perubahan key SoundSlot yang masih dipakai di `steps`, **agar** rumus pukulan yang sudah disusun User tidak jadi rujukan rusak.

*FR: FR-SLOT-05, FR-SLOT-06*

| Task | Layer | Estimasi |
|---|---|---|
| `DELETE /sound-slots/:id` — cek pemakaian key di `steps`, 409 jika masih dipakai | Backend | M |
| `PUT /sound-slots/:id` — tolak 400 jika ganti key yang masih dipakai | Backend | S |
| UI pesan error yang mengarahkan User membersihkan step dulu | Frontend | S |

### Story E5-3: Memilih Sample untuk SoundSlot (Dua Kelompok)
**Sebagai** User, **saya bisa** memilih Sample dari library saya atau dari Sample Bawaan untuk suatu SoundSlot, **agar** saya bisa memakai bunyi sendiri maupun bunyi siap pakai.

*FR: FR-SLOT-07, FR-SLOT-08, FR-SAMP-14*

> **Catatan dependency:** Optgroup "Bawaan" pada Story ini baru terisi data setelah Epic E6 (seeding) berjalan — sebelum itu, dropdown hanya menampilkan "Sample Saya" tanpa error.

| Task | Layer | Estimasi |
|---|---|---|
| Komponen `SamplePicker.tsx` — dropdown dua optgroup (Bawaan / Saya) | Frontend | M |
| Endpoint gabungan atau dua call terpisah (`GET /samples` + `GET /samples/templates`) untuk populate picker | Frontend | S |

### Story E5-4: Step Editor (Grid Sequencer)
**Sebagai** User, **saya bisa** mengetuk kotak pada grid step untuk menyusun rumus pukulan, **agar** saya tidak perlu mengetik karakter manual satu-satu.

*FR: FR-SEQ-01, FR-SEQ-02, FR-SEQ-03, FR-SEQ-04*

| Task | Layer | Estimasi |
|---|---|---|
| `PUT /section-parts/:id` — validasi tiap karakter `steps` merujuk ke key SoundSlot yang ada (`utility/steps_validator.go`, query DB) | Backend | L |
| Komponen `StepGrid.tsx` — jumlah baris dinamis mengikuti jumlah SoundSlot, klik toggle per kotak | Frontend | L |
| Serialisasi grid ↔ string `steps` (encode/decode) | Frontend | M |

### Story E5-5: Preview Audio saat Edit Steps
**Sebagai** User, **saya bisa** mendengar preview satu Part sebelum menyimpan, **agar** saya tahu hasilnya sesuai tanpa harus membuka Launcher Mode dulu.

*FR: FR-SEQ-05*

| Task | Layer | Estimasi |
|---|---|---|
| Playback preview 1 SectionPart (subset dari playback engine E7, dipakai lebih awal) | Frontend | M |

---

## Epic E6 — Song & Sample Template System

**Tujuan:** Konten bawaan platform (Song + Sample) yang read-only, dapat diakses Guest, sebagai demo instan dan starting point onboarding. **Bergantung penuh pada E2–E5 selesai** karena butuh skema data lengkap sebelum bisa di-seed.

**FR Terkait:** FR-SONG-07–10, FR-SAMP-11–14

### Story E6-1: Seeder Sample Template System
**Sebagai** operator platform, **saya bisa** menjalankan script seeder untuk mengunggah audio rebana asli sebagai Sample Template, **agar** User baru langsung punya bunyi siap pakai tanpa upload sendiri.

*FR: FR-SAMP-11, FR-SAMP-12, FR-SAMP-13*

| Task | Layer | Estimasi |
|---|---|---|
| `seeders/sample_templates.go` — baca file lokal, upload ke object storage (`samples/system/`), insert dengan `is_system_template=true` | Backend | M |
| Siapkan & susun file audio rebana asli (10 file: 5 Part × Tak/Dung minimal) sebagai input seeder | Konten | M |
| `GET /samples/templates` endpoint | Backend | S |
| Proteksi 403 pada `PUT`/`DELETE /samples/:id` jika `is_system_template=true` | Backend | S |

### Story E6-2: Seeder Song Template System
**Sebagai** operator platform, **saya bisa** menjalankan script seeder untuk membuat Song bawaan dengan susunan Section standar Al-Banjari, **agar** Guest punya sesuatu yang bisa langsung dimainkan.

*FR: FR-SONG-07, FR-SONG-08, FR-SONG-09*

| Task | Layer | Estimasi |
|---|---|---|
| `seeders/song_templates.go` — insert Song + Section (Awalan/Dasar/Naik/Turun/Penutup) + SectionPart + SoundSlot + `steps`, referensi ke Sample Template dari E6-1 | Backend | L |
| Susun rumus `steps` untuk minimal 1 lagu penuh (kerja sama dengan sumber musik asli) | Konten | L |
| `GET /songs/templates` endpoint | Backend | S |
| Proteksi 403 pada `PUT`/`DELETE /songs/:id` jika `is_system_template=true` | Backend | S |
| Halaman/tab "Song Bawaan" terpisah dari "Lagu Saya" | Frontend | M |

### Story E6-3: Duplikasi Template ke Song Milik Sendiri
**Sebagai** User (login), **saya bisa** menduplikasi Song Template System, **agar** saya punya starting point untuk memodifikasi bebas.

*FR: FR-SONG-10*

| Task | Layer | Estimasi |
|---|---|---|
| Pastikan `POST /songs/:id/duplicate` (dari E2-3) juga berfungsi untuk sumber `is_system_template=true`, hasil selalu `is_system_template=false` | Backend | S |
| Tombol "Duplikasi ke Song Saya" pada tampilan Song Template | Frontend | S |

---

## Epic E7 — Pattern Launcher (Playback)

**Tujuan:** Mode pemutaran live — konsumen akhir dari seluruh data yang disusun di Epic sebelumnya. Playback engine berjalan sepenuhnya di client.

**FR Terkait:** FR-PLAY-01–11

### Story E7-1: Playback Engine Inti (Web Worker + Lookahead Scheduling)
**Sebagai** User, **saya bisa** memutar pattern dengan timing yang presisi dan tidak drift, **agar** pengalaman bermain terasa musikal, bukan patah-patah.

*FR: FR-PLAY-02, FR-PLAY-03, FR-PLAY-05*

| Task | Layer | Estimasi |
|---|---|---|
| `clock.worker.ts` — Web Worker sebagai timer independen | Frontend | M |
| `scheduler.ts` — lookahead scheduling, jadwalkan ke `AudioContext` | Frontend | L |
| `audio-buffer-cache.ts` — in-memory cache `AudioBuffer` per Sample | Frontend | M |
| Prefetch & decode seluruh Sample yang direferensikan Song saat Launcher dibuka | Frontend | M |

### Story E7-2: Grid Pad Dinamis & Quantized Trigger
**Sebagai** User, **saya bisa** mengetuk pad Section dan berpindah pad lain tanpa transisi terpotong paksa, **agar** perpindahan antar bagian lagu terdengar musikal.

*FR: FR-PLAY-01, FR-PLAY-04, FR-PLAY-07, FR-PLAY-08*

| Task | Layer | Estimasi |
|---|---|---|
| `section-player.ts` — state `active`/`pendingNext`, logic quantized trigger | Frontend | L |
| Komponen `LauncherGrid.tsx` — pad dinamis sejumlah Section | Frontend | M |
| `PlaybackIndicator.tsx` — indikator Section aktif & posisi step | Frontend | M |

### Story E7-3: Hard Cut Tempo Antar Section
**Sebagai** User, **saya bisa** merasakan tempo berubah seketika saat berpindah ke Section dengan BPM berbeda, **agar** transisi tempo terasa jelas dan sesuai desain (bukan ramp bertahap).

*FR: FR-PLAY-11*

| Task | Layer | Estimasi |
|---|---|---|
| Logic penentuan BPM efektif per Section (`bpm_override` vs `song.bpm`) di `section-player.ts` | Frontend | S |
| Terapkan BPM baru ke `scheduler.ts` tepat saat quantized trigger tercapai, tanpa interpolasi | Frontend | M |

### Story E7-4: Kontrol Stop & Silent Step
**Sebagai** User, **saya bisa** menghentikan playback kapan saja, dan Section tetap berjalan normal meski ada SoundSlot yang belum ada Sample-nya, **agar** pengalaman bermain tidak terganggu data yang belum lengkap.

*FR: FR-PLAY-06, FR-PLAY-09*

| Task | Layer | Estimasi |
|---|---|---|
| Tombol Stop — hentikan seluruh scheduling & worker | Frontend | S |
| Handling step dengan SoundSlot kosong → skip tanpa error | Frontend | S |

### Story E7-5 (Could): Mute per Part
**Sebagai** User, **saya bisa** mematikan sementara salah satu Part saat playback, **agar** saya bisa fokus latihan pada part tertentu.

*FR: FR-PLAY-10 (Could — boleh masuk backlog Fase 1.1 jika waktu MVP terbatas)*

| Task | Layer | Estimasi |
|---|---|---|
| Kontrol mute/unmute per Part di Launcher UI | Frontend | M |

---

## 3. Ringkasan Prioritas & Estimasi

| Epic | Jumlah Story | Story Must | Story Should/Could | Estimasi Total (kasar) |
|---|---|---|---|---|
| E0 — Fondasi | 4 | 4 | 0 | M–L |
| E1 — Auth & Guest | 3 | 3 | 0 | M |
| E2 — Song | 3 | 2 | 1 (E2-3) | M |
| E3 — Section & BPM | 4 | 4 | 0 | M–L |
| E4 — Sample | 4 | 3 | 1 (bag. E4-2) | M |
| E5 — SoundSlot & Sequencer | 5 | 5 | 0 | L–XL |
| E6 — Template System | 3 | 3 | 0 (E6-3 Should) | L |
| E7 — Launcher | 5 | 4 | 1 (E7-5) | L–XL |

> **Catatan:** Epic E5 dan E7 adalah yang paling besar (playback engine & step editor keduanya kompleks) — pertimbangkan alokasi sprint lebih banyak atau developer paling senior untuk dua Epic ini.

---

## 4. Urutan Sprint yang Disarankan (Ilustratif)

Bukan keputusan final — hanya starting point untuk sesi Sprint Planning:

```
Sprint 1  → E0 (Fondasi) + E1 (Auth & Guest)
Sprint 2  → E2 (Song) + E3 (Section & BPM)
Sprint 3  → E4 (Sample) + mulai E5 (SoundSlot)
Sprint 4  → Selesaikan E5 (Sequencer)
Sprint 5  → E6 (Template System) — butuh E2–E5 selesai
Sprint 6  → E7 (Launcher) — butuh seluruh data model matang
Sprint 7  → Buffer: bug fixing, E7-5 (Could), polish sebelum rilis
```

> Song/Sample Template System (E6) sengaja diletakkan setelah fitur inti CRUD selesai — bukan karena kurang penting secara produk (justru ini yang membuat Guest bisa langsung mencoba), tapi karena **secara teknis bergantung** pada skema Section/SectionPart/SoundSlot yang stabil sebelum bisa di-seed dengan benar.

---

## 5. Hal yang Perlu Diperjelas Sebelum Sprint Planning Dimulai

| # | Pertanyaan | Dampak |
|---|---|---|
| 1 | Siapa yang menyiapkan konten seeding (audio + susunan `steps` lagu template di E6)? Tim engineering atau perlu kolaborasi dengan pihak yang paham musik Al-Banjari? | Estimasi Story E6-1/E6-2 (kategori "Konten") bisa berubah signifikan tergantung siapa mengerjakan |
| 2 | Berapa jumlah developer & alokasi Backend vs Frontend? | Menentukan apakah urutan sprint di atas realistis untuk dieksekusi paralel atau sekuensial |
| 3 | Apakah story point/estimasi ingin dikonversi dari T-shirt size, atau tetap kualitatif untuk sprint pertama? | Mempengaruhi cara tim commit ke sprint |

---

## 6. Referensi

- PRD: `PRD-bandjari.md`
- TDD: `TDD-bandjari.md`
- Wireframe: `bandjari-wireframe.html`
