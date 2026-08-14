# Implementation Plan: Tindak Lanjut Review Role System (Admin/User)

## Overview

Menindaklanjuti hasil code review implementasi role `admin`/`user`: 3 temuan *Important* (revocation role, navigasi buat template, cakupan tes guard) dan 5 *Suggestion* (readOnly rute song, tes utility, reset state upload, role dari login response, tes UI admin). Semua perubahan berukuran S–M, tidak ada yang menyentuh skema DB baru.

## Architecture Decisions

- **Guard tetap terpusat di `service/access.go`** — tes positif admin ditambahkan di level service (bukan handler) karena pola tes repo semuanya fake-service.
- **Revocation role:** dua opsi — (A) cek role ke DB di middleware JWT, (B) perpendek TTL token. Rekomendasi: **(B) TTL token admin lebih pendek (2 jam)** untuk sekarang + dokumentasi di TDD; opsi (A) dicatat sebagai kerja lanjutan (butuh injeksi repository ke middleware). Menunggu keputusan user — lihat Open Questions.
- **Navigasi setelah buat template** mengikuti identitas data: template → `/templates/$songId`, song user → `/songs/$songId`.

## Task List

### Phase 1: Authorization Hardening
- [x] Task 1: Terapkan keputusan revocation role — **Opsi A: cek role ke DB di middleware**
- [x] Task 2: Unit test `GetCurrentUserRole`/`IsAdmin` di utility
- [x] Task 3: Dokumentasikan sistem role & matriks akses di TDD

### Checkpoint: Foundation
- [x] `go test ./...` hijau; build platform hijau; TDD konsisten dengan kode

### Phase 2: Guard Coverage
- [x] Task 4: Tes positif admin untuk guard SectionPart & SoundSlot (template boleh dimutasi)

### Checkpoint: Core Features
- [x] Semua jalur admin (song/section/part/slot/sample) punya tes positif & negatif

### Phase 3: UX & Polish
- [x] Task 5: Navigasi buat Song Template → `/templates/$songId`
- [x] Task 6: `songs.$songId.index.tsx` readOnly untuk template non-admin
- [x] Task 7: Reset `asTemplate` saat form upload sample ditutup
- [x] Task 8: Gunakan `role` dari LoginUserResponse untuk optimistik set role saat login

### Checkpoint: Complete
- [x] Semua acceptance criteria terpenuhi, build & tes hijau, siap review

### Phase 4: Deferred (Tech Debt)
- [ ] Task 9 (opsional): Tes UI frontend untuk kontrol admin (perlu setup vitest + testing-library)

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Perubahan middleware JWT (jika opsi A) menyentuh semua endpoint | High | Pilih opsi B (TTL) dulu; opsi A jadi kerja terpisah |
| Tes positif guard meniru pola fake yang sudah ada | Low | Ikuti pola `setupSlotEnv`/`setupPartEnv` yang sudah ada |
| Navigasi template salah halaman jika payload diubah orval | Low | Gunakan `payload.is_system_template` yang sudah ada di klien |

## Open Questions
- [x] **Revocation role:** ✅ Diputuskan **Opsi A** — role disinkronkan dari DB di middleware `JWTAuth` (implementasi selesai).
- [x] **Task 8 (role dari login response):** ✅ Diputuskan **pakai** — role login disimpan optimistik, profile menimpa.
