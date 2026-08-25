# Task 4: Frontend — Halaman Profile 5 Bagian

> **Epic:** E-PROFILE-2026 (docs/core/epic-profile-account.md) · **Tipe:** feature
> **Prioritas:** 1 · **Status:** ✅ SELESAI (2026-08-25)

## Goal

Rombak `ProfileView` dari kartu identitas + placeholder "Segera hadir" menjadi
halaman pengelolaan akun 5 bagian (E-PROFILE-2026 R15–18), memakai seluruh
endpoint backend Task 1–3.

## Komponen

1. **Identitas** — avatar inisial, nama, email, badge role + **status verifikasi
   email** (chip ✓ / "Belum diverifikasi" + tombol kirim ulang cooldown 60s).
2. **Edit Profil** — `EditNameForm` (PATCH /users → invalidate query user).
3. **Keamanan** — `ChangePasswordForm` (akun ber-password) / `SetPasswordForm`
   (akun Google-only) + `ConnectedAccountsCard` (Google: Terhubung/Tidak,
   tombol Link/Unlink).
4. **Sesi Aktif** — `SessionsCard` (useGetAuthSessions + revoke per sesi,
   label "Sesi ini").
5. **Zona Berbahaya** — `DeleteAccountDialog` (konfirmasi + field password bila
   `has_password`; sukses → logout + navigasi home).

## Implementasi

### 1. Study existing code dulu

- `features/auth/components/ProfileView.tsx` — struktur lama + placeholder
- `features/auth/components/RegisterForm.tsx` / `LoginForm.tsx` — pola form,
  `useToast`, `ApiError`, `FormField`, `Button`
- `features/auth/components/VerifyEmailBanner.tsx` — pola resend + cooldown
- `features/auth/components/GoogleLoginButton.tsx` — redirect `?link=1`
- `components/molecules/ConfirmDialog.tsx` — dialog konfirmasi
- `api/endpoints/auth/auth.ts` — hook Orval: `usePatchUsers`,
  `usePostAuthChangePassword`, `usePostAuthSetPassword`, `useGetAuthSessions`,
  `usePostAuthSessionsIdRevoke`, `usePostAuthDeleteAccount`
- `AuthContext.tsx` — `useAuth()` (user, isAdmin, logout), query key user
- `features/auth/components/LoginForm.test.tsx` — pola test (render dengan
  RouterProvider + QueryClient + ToastProvider + AuthProvider, mock fetch)

### 2. Tulis test dulu (TDD) — `ProfileView.test.tsx`

- Menampilkan 5 bagian & status verifikasi (chip + tombol kirim ulang)
- Edit nama: submit → PATCH /users → user query di-invalidate + toast sukses
- Change password: akun ber-password → form tampil; submit sukses → toast
- Akun Google-only: form set-password tampil (bukan change-password)
- Unlink Google: tombol muncul; konfirmasi → DELETE /auth/providers/google
- Sesi: daftar device tampil + "Sesi ini" + revoke memanggil endpoint
- Delete account: dialog konfirmasi + password; sukses → logout + navigate home

### 3. Checklist implementasi

- [x] `EditNameForm.tsx` — form nama, `usePatchUsers`, invalidate
      `getGetUsersQueryKey()`, toast, reset form
- [x] `ChangePasswordForm.tsx` — current + new + confirm (client-side match),
      `usePostAuthChangePassword`
- [x] `SetPasswordForm.tsx` — new + confirm, `usePostAuthSetPassword`
- [x] `ConnectedAccountsCard.tsx` — status Google dari `user.providers`,
      tombol Link (redirect `/auth/google?link=1` via GoogleLoginButton
      dengan label kustom) / Unlink (`DELETE /auth/providers/google` via
      customInstance + invalidate user), guard `has_password` (akun
      Google-only: pesan "butuh password")
- [x] `SessionsCard.tsx` — `useGetAuthSessions`, render list (user_agent, ip,
      tanggal), badge "Sesi ini", tombol "Putuskan" → `usePostAuthSessionsIdRevoke`
      → invalidate sessions
- [x] `DeleteAccountDialog.tsx` — `ConfirmDialog` + FormField password bila
      `has_password`; `usePostAuthDeleteAccount`; sukses → `logout()` +
      navigate `/`
- [x] `ProfileView.tsx` — rakit 5 bagian; chip verifikasi (reuse
      `useResendCooldown`); hapus placeholder "Segera hadir"
- [x] Frontend test baru hijau; `tsc` + `biome lint` + `vitest` + `build` lulus

## Success Criteria

- [x] Semua 5 bagian halaman Profile berfungsi end-to-end
- [x] Guest tetap melihat prompt login (FR-AUTH-07 — tidak berubah)
- [x] Test frontend baru lulus (9 test ProfileView) + 108 test lama tetap hijau
- [x] `tsc` + `biome` + `build` bersih
