# Todo: BandJari — Fase 1 (MVP)

Checklist eksekusi turunan dari `tasks/plan.md`. Centang saat task selesai + verification lolos. Mapping story breakdown.md di kurung.

## Phase 1: Fondasi & Pelurusan (E0 + E1)

- [x] **T1** Selaraskan skema `users` dengan TDD (E0-2, E1-1)
- [x] **T2** Base path `/api/v1` + endpoint `auth/*` (E0-4, E1-1)
- [x] **T3** Klaim JWT + middleware `optional_auth.go` (E1-2)
- [x] **T4** Middleware `owner_check.go` (E1-2)
- [x] **T5** Sinkronkan frontend auth + mutator (E1-1, E1-3)
- [x] **T6** Komponen `LoginPromptInline` (E1-3)
- [x] **T7** Fondasi object storage (MinIO + signed URL) (E0-3)

### Checkpoint: Fondasi
- [x] Test backend & frontend lolos
- [x] Register → login → profile di `/api/v1`
- [x] MinIO lokal berjalan + signed URL terverifikasi

## Phase 2: Manajemen Song (E2)

- [x] **T8** Model & migrasi `Song` (E0-2, E2-1) — sekaligus seluruh model domain (Section/SectionPart/SoundSlot/Sample) + constraint
- [x] **T9** Endpoint Song — create & list (E2-1)
- [x] **T10** Endpoint Song — update, delete, duplicate (E2-2, E2-3)
- [x] **T11** Frontend — daftar Song & kelola (E2-1/2/3)

### Checkpoint: Song
- [x] CRUD Song end-to-end (e2e script: register → login → create → list → update → duplicate → delete)
- [x] Akses lintas user ditolak (Guest → 404, terverifikasi e2e)

## Phase 3: Manajemen Section & BPM (E3)

- [x] **T12** Model & migrasi `Section` + `SectionPart` (E0-2, E3-1) — selesai di batch skema Phase 2
- [x] **T13** `POST /songs/:songId/sections` — auto 5 SectionPart (E3-1)
- [x] **T14** Endpoint Section — update, reorder, delete, duplicate (E3-2/3/4)
- [x] **T15** Frontend — Section strip & BPM badge (E3-1 s/d E3-4)

### Checkpoint: Song + Section
- [x] Song multi-Section tersimpan; urutan & BPM override benar (e2e: 3 section, reorder, override set/clear, duplikasi, hapus)
- [x] Setiap Section punya tepat 5 SectionPart (diverifikasi via SQL)

## Phase 4: Manajemen Sample Audio (E4)

- [x] **T16** Model & migrasi `Sample` (E0-2, E4-1) — selesai di batch skema Phase 2
- [x] **T17** Upload Sample (validasi .wav, 5MB) (E4-1)
- [x] **T18** Library Sample — list, rename, delete + proteksi (E4-2, E4-3)
- [x] **T19** Playback URL Sample (signed URL) (E4-4)
- [x] **T20** Frontend — Sample Library + upload (E4-1/2/4)

### Checkpoint: Sample
- [x] Upload → preview → reuse → proteksi hapus end-to-end (e2e: file asli 490KB → 201, non-wav → 415, signed URL → 200, rename, delete)
- [x] Proteksi 409 (referensi) & 403 (template) ter-cover unit test

## Phase 5: SoundSlot & Sequencer (E5)

- [x] **T21** Model & migrasi `SoundSlot` (E0-2, E5-1) — selesai di batch skema Phase 2
- [x] **T22** Endpoint SoundSlot + proteksi key (E5-1, E5-2)
- [x] **T23** Default SoundSlot + auto-attach Sample Template (E5-1, FR-SLOT-09)
- [x] **T24** `PUT /section-parts/:id` + validator `steps` dinamis (E5-4)
- [x] **T25** Frontend — SoundSlotManager + SamplePicker (E5-1, E5-3)
- [x] **T26** Frontend — StepGrid + serialisasi steps (E5-4)
- [x] **T27** Preview audio per SectionPart (E5-5, FR-SEQ-05)

### Checkpoint: Sequencer
- [x] Pattern multi-bunyi tersimpan & tervalidasi; preview terdengar
- [x] e2e 9 skenario: default slot, steps valid/invalid, duplikat key 400, proteksi hapus/ubah key (409/400), Guest 404

## Phase 6: Template System (E6)

- [x] **T28** Seeder Sample Template + endpoint templates (E6-1) — 13 file audio asli di-seed
- [x] **T29** Seeder Song Template + endpoint templates (E6-2) — steps placeholder (menunggu susunan asli dari pemilik produk)
- [x] **T30** Frontend — Song Bawaan, akses Guest, duplikasi (E6-2, E6-3)

### Checkpoint: Template System
- [x] Guest memainkan lagu bawaan tanpa login; duplikasi ke Song milik sendiri berfungsi (e2e backend: Guest 200, 403 proteksi, auto-attach AC-10)
- [ ] Verifikasi visual browser oleh user (pnpm dev)

## Phase 7: Pattern Launcher (E7)

- [x] **T31** Playback engine inti — worker & scheduler (E7-1)
- [x] **T32** AudioBuffer cache + prefetch (E7-1)
- [x] **T33** LauncherGrid + quantized trigger + indikator (E7-2)
- [x] **T34** Hard cut BPM + Stop + silent step (E7-3, E7-4)
- [x] **T35** (Could) Mute per Part (E7-5) — selesai di redesign Slice 6 (RD-6)

### Checkpoint: Launcher (Final)
- [x] Alur lengkap: Song → Section → pattern → sample → playback live (data nested terverifikasi via API; engine + quantized trigger ter-cover unit test)
- [ ] AC-1 s/d AC-12 PRD terverifikasi menyeluruh (backend e2e ✅; visual browser menunggu pengguna)
- [ ] Browser matrix + layar sentuh teruji (NFR-02/07) — menunggu verifikasi manual pengguna

## Sebelum Mulai Implementasi

- [x] Open Questions di `tasks/plan.md` dijawab (terutama #1 konten seeding & #3 skema users)
- [x] Plan direview & disetujui
- [x] DB dev di-reset bila Task 1 mengubah skema `users`

## Redesign UI — Fase 1.5 (sesuai Wireframe)

- [x] **RD-0** Design tokens brand teal + komponen bersama (Badge, PageHeader, SectionHeader, EmptyState, TopBar)
- [x] **RD-1** Landing: kartu Song Template + badge SYSTEM + ▶ Main, CTA login (layar 0)
- [x] **RD-2** Daftar Lagu: section_count backend, form "Simpan & Lanjut ke Section →", meta BPM·N Section·diubah (layar 1)
- [x] **RD-3** Detail Song: banner Guest, strip chip #N + BPM ★, panel Section Terpilih + Ringkasan Song (layar 2)
- [x] **RD-4** Sequencer: grid terpadu 5 Part, playhead, ±8 step, panel SoundSlot 2 optgroup (layar 3)
- [x] **RD-5** Sample Library: usage_count backend, dua seksi Bawaan/Saya, error 409 inline (layar 4)
- [x] **RD-6** Launcher: status pad + step-dots + transport + Mute per Part FR-PLAY-10 (layar 5)
- [x] **RD-7** Verifikasi: Playwright alur lengkap + Guest (14 langkah, 0 console error, 0 respons 4xx) + screenshot 10 layar

### Checkpoint: Redesign
- [x] `go test ./...` hijau + swagger/orval regen bersih
- [x] `pnpm build` + `pnpm test` (20 tes) hijau
- [x] E2E dev: beranda → template → sequencer read-only → launcher (Guest) + alur lengkap user → sample library
