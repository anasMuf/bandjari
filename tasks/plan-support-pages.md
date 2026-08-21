# Implementation Plan: Halaman Support & Pelengkap Produk

## Overview

Menambahkan halaman standar produk digital (industri standar): **Donasi, FAQ, Bantuan, Kontak, Tentang, Kebijakan Privasi, Syarat & Ketentuan** — semuanya frontend-only (tanpa perubahan backend/API).

## Keputusan Desain (hasil brainstorming)

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Penempatan | Desktop: navbar atas (dropdown Bantuan + tombol Donasi) & footer; Mobile: seksi di halaman Profile |
| 2 | Cakupan | Set lengkap 7 halaman |
| 3 | Mekanisme donasi | Nomor rekening/e-wallet + tombol copy (clipboard + Toast) |
| 4 | Sumber konten | File Markdown dirender (`?raw` import Vite + `react-markdown`) |
| 5 | Form kontak | Info kontak + mailto/WhatsApp (tanpa backend) |

## Arsitektur

- Semua route baru di dalam shell `/_app` (mewarisi navbar + bottom nav + footer).
- Konten Markdown di `src/features/support/content/*.md`; dirender `react-markdown` + `prose` (`@tailwindcss/typography` — sudah di devDeps, aktifkan via `@plugin` di `styles.css`).
- FAQ: markdown di-split per heading `## ` → akordeon `<details>` (native, accessible).
- Konfigurasi statis `supportConfig.ts`: metode donasi, kontak (email/WA), daftar link support.
- SEO: `seoMeta()` di tiap route (indexable).

## Task List

### Phase 1: Foundation
- [x] Task 1: Install `react-markdown` + aktifkan plugin typography di `styles.css`
- [x] Task 2: `supportConfig.ts` (donasi, kontak, link support) + 5 file konten Markdown

### Phase 2: Komponen & Halaman
- [x] Task 3: `MarkdownContent`, `FaqAccordion`, view Donasi/Kontak/Tentang/Legal/Bantuan/FAQ
- [x] Task 4: 7 route file di `src/routes/_app/` (dengan `seoMeta`)

### Phase 3: Navigasi
- [x] Task 5: `AppNav` — dropdown "Bantuan" + tombol "Donasi"
- [x] Task 6: `Footer` baru (desktop) di shell `_app.tsx`
- [x] Task 7: `ProfileView` — seksi "Bantuan & Informasi" (mobile)

### Checkpoint: Complete
- [x] Build platform hijau, lint bersih, tes platform hijau (69/69)
- [ ] Manual: copy donasi, akordeon FAQ, navigasi desktop & mobile

## Anti-Patterns (FORBIDDEN)
- ❌ Tanpa perubahan backend/API (keputusan: konten statis frontend)
- ❌ Tanpa dependency tambahan selain `react-markdown`
- ❌ Tanpa "integrasi pembayaran" palsu (cukup nomor + copy — keputusan #3)
- ❌ Tanpa route baru di luar shell `/_app`

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| `react-markdown` versi terbaru butuh React 19 | Low | React 19 sudah terpasang; pilih versi compatible |
| Konten placeholder donasi tampil di produksi | Medium | Komentar jelas di `supportConfig.ts` + nilai placeholder eksplisit |
| `routeTree.gen.ts` perlu regenerate | Low | Plugin TanStack Router regenerate otomatis saat dev/build |
