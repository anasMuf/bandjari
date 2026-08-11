# Panduan Pembuatan Issue

Gunakan template ini saat membuat issue agar informasi yang diberikan lengkap dan memudahkan proses perbaikan atau pengembangan.

## Problem (Masalah / Konteks)
Jelaskan masalah atau konteks fitur dengan jelas dan ringkas.
- Apa yang ingin dicapai?
- Mengapa ini menjadi sebuah masalah atau kebutuhan?
- Jika ini adalah fitur baru, sebutkan referensi ke PRD jika ada.

## Current Behavior (Kondisi Saat Ini)
Jelaskan apa yang terjadi saat ini (khusus untuk bug/perbaikan).
- Buat sespesifik mungkin.
- Sertakan langkah-langkah untuk mereproduksi masalah (Steps to Reproduce).
- Lampirkan error logs, screenshot, atau video jika ada.

## Expected Behavior (Kondisi yang Diharapkan)
Jelaskan bagaimana sistem seharusnya berjalan saat berfungsi dengan benar.
- Jika ini adalah perbaikan UI/UX, referensikan ke `docs/ux-flow.md` atau `docs/ui-spec.md`.
- Jika ini adalah masalah API, referensikan ke `docs/api-contract.md`.

## Relevant Files / Area (File atau Area Terkait)
Sebutkan direktori atau file yang berkaitan dengan issue ini.
Contoh:
- Backend: `apps/api/handler/user_handler.go`, `apps/api/service/...`
- Frontend: `apps/platform/src/features/auth/...`
- Docs: `docs/fitur-a/...`

## Task (Daftar Pekerjaan)
Buat daftar langkah-langkah spesifik yang dapat ditindaklanjuti untuk menyelesaikan issue ini.
Gunakan format checklist:
- [ ] Task 1 (contoh: Update API contract)
- [ ] Task 2 (contoh: Implementasi endpoint backend)
- [ ] Task 3 (contoh: Update frontend komponen)
