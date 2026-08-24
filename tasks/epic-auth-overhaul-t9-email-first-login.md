# Task 9: Email-First Login (pisah input email & password)

> **Epic:** E-AUTH-2026 (lanjutan) · **Tipe:** feature · **Status:** ✅ SELESAI (2026-08-24)

## Goal

Meningkatkan UX login: pisahkan input **email** dan **password** menjadi 2
langkah. Setelah email dicek, tampilkan layar yang relevan — akun Google
langsung diarahkan ke tombol "Masuk dengan Google" (tanpa minta password yang
pasti gagal), akun password lanjut ke form password, email tak dikenal
ditawarkan daftar.

## Backend — `POST /auth/check-email`

- `dto`: `CheckEmailRequest{Email}`, `CheckEmailResponse{Method}`. ✅
- `UserService.CheckEmailMethod(email)` → `password` | `google` | `none`. ✅
- Handler + route `POST /auth/check-email` (rate limited via `/auth/*`). ✅
- **Trade-off anti-enumeration**: mengungkap keberadaan email — diterima
  (email-first login; rate limit & lockout membatasi). ✅
- TDD: `TestCheckEmailMethod` — password / google / none. ✅

## Frontend — `LoginForm` 2 langkah

- State machine: `email` → `password` | `google` | `none`. ✅
- Langkah 1: input email + tombol "Lanjut" → `POST /auth/check-email`. ✅
- Langkah 2:
  - `password` → form password + "Masuk" + link "Lupa password?" + "← Ganti email" ✅
  - `google` → banner + `GoogleLoginButton` (tanpa form password) + "← Ganti email" ✅
  - `none` → info belum terdaftar + link Daftar + `GoogleLoginButton` + "← Ganti email" ✅
- Tombol Google tetap di langkah 1. ✅
- Test: 3 test (google/password/none) — mock fetch + RouterProvider. ✅
- `login.tsx`: duplikasi tombol Google/divider/lupa password dihapus (pindah
  ke dalam form). ✅

## Success Criteria

- [x] `go test ./...` lulus (test check-email baru)
- [x] `tsc` + `biome` + `vitest` (102) + `build` lulus (frontend)
- [x] Akun Google tidak diminta password (langsung tombol Google)
- [x] Email tak dikenal diarahkan daftar
