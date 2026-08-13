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

- [ ] **T21** Model & migrasi `SoundSlot` (E0-2, E5-1)
- [ ] **T22** Endpoint SoundSlot + proteksi key (E5-1, E5-2)
- [ ] **T23** Default SoundSlot + auto-attach Sample Template (E5-1, FR-SLOT-09)
- [ ] **T24** `PUT /section-parts/:id` + validator `steps` dinamis (E5-4)
- [ ] **T25** Frontend — SoundSlotManager + SamplePicker (E5-1, E5-3)
- [ ] **T26** Frontend — StepGrid + serialisasi steps (E5-4)
- [ ] **T27** Preview audio per SectionPart (E5-5, FR-SEQ-05)

### Checkpoint: Sequencer
- [ ] Pattern multi-bunyi tersimpan & tervalidasi; preview terdengar

## Phase 6: Template System (E6)

- [ ] **T28** Seeder Sample Template + endpoint templates (E6-1)
- [ ] **T29** Seeder Song Template + endpoint templates (E6-2)
- [ ] **T30** Frontend — Song Bawaan, akses Guest, duplikasi (E6-2, E6-3)

### Checkpoint: Template System
- [ ] Guest memainkan lagu bawaan tanpa login; duplikasi ke Song milik sendiri berfungsi

## Phase 7: Pattern Launcher (E7)

- [ ] **T31** Playback engine inti — worker & scheduler (E7-1)
- [ ] **T32** AudioBuffer cache + prefetch (E7-1)
- [ ] **T33** LauncherGrid + quantized trigger + indikator (E7-2)
- [ ] **T34** Hard cut BPM + Stop + silent step (E7-3, E7-4)
- [ ] **T35** (Could) Mute per Part (E7-5)

### Checkpoint: Launcher (Final)
- [ ] Alur lengkap: Song → Section → pattern → sample → playback live
- [ ] AC-1 s/d AC-12 PRD terverifikasi
- [ ] Browser matrix + layar sentuh teruji (NFR-02/07)

## Sebelum Mulai Implementasi

- [ ] Open Questions di `tasks/plan.md` dijawab (terutama #1 konten seeding & #3 skema users)
- [ ] Plan direview & disetujui
- [ ] DB dev di-reset bila Task 1 mengubah skema `users`
