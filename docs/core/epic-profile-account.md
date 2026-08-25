# Epic: Profile & Account Management (E-PROFILE-2026)

> **Status:** Disetujui (design validated) · **Tipe:** Epic · **Prioritas:** 1
> **Dibuat:** 2026-08-24 · **Referensi:** E-AUTH-2026 (fondasi auth), FR-AUTH-07, dokumen privasi §5

Epic ini melengkapi halaman Profile (saat ini hanya kartu identitas + placeholder
"Pengaturan — Segera hadir") menjadi halaman pengelolaan akun sesuai standar
industri: status verifikasi email, edit profil, keamanan (ganti password),
akun terhubung (link/unlink provider OAuth), kelola sesi aktif, dan hapus akun.

---

## Requirements (IMMUTABLE)

### Data & model
1. **Model baru `user_providers`**: `id`, `user_id` (FK users), `provider`
   (`"google"` — enum siap diperluas), `provider_subject` (sub dari provider),
   `created_at`, `updated_at`, `deleted_at`. Constraint **unique**
   `(provider, provider_subject)` + unique `(user_id, provider)` (satu user satu
   link per provider).
2. **Perilaku login Google (keputusan V1-A)**: match login berdasarkan
   `(provider, provider_subject)` terlebih dahulu. Bila tidak cocok:
   - Email cocok **dan akun tanpa password** (akun Google legacy) → auto-link +
     **backfill** row `user_providers`, lanjut login (perilaku lama dipertahankan).
   - Email cocok **tapi akun punya password** → **TOLAK login Google**
     (kode error eksplisit, mis. `GOOGLE_LINK_REQUIRED`), arahkan: "Masuk dengan
     password, lalu hubungkan Google dari Pengaturan." Auto-link ulang TIDAK
     terjadi setelah unlink (membuat unlink bermakna).
   - Email tidak terdaftar → buat akun baru (Google-only, tanpa password,
     `email_verified_at` sesuai info Google) + row provider.
3. **Link Google dari pengaturan (akun sudah login)**: alur `/auth/google?link=1`
   — state cookie mencatat mode link; callback memvalidasi refresh cookie
   (user sedang login) lalu membuat row provider untuk user tersebut dan
   redirect ke halaman profile. Bila user tidak login saat link → redirect
   ke `/login`.
4. **Unlink Google**: `DELETE /auth/providers/google` (wajib login). **Hanya
   diizinkan bila akun punya password** (atau provider lain) — akun Google-only
   tidak boleh kehilangan satu-satunya metode login. Blokir dengan pesan jelas
   (arahkan ke set password).
5. `googleUserinfo` backend ditambah field `sub`/`id` dari
   `https://www.googleapis.com/oauth2/v2/userinfo` (dipakai `provider_subject`).

### Endpoint baru (semua wajib login kecuali disebut, audit event menyertai)
6. `PATCH /users` — update **nama** (`{name}` min 1 maks 255). Email/avatar
   TIDAK termasuk iterasi ini (keputusan Q2-A).
7. `POST /auth/change-password` — `{current_password, new_password}`. Verifikasi
   `current_password` (bcrypt), validasi policy (min 8, maks 72 — NIST), update
   `password_hash` + `password_changed_at`, lalu **revoke SEMUA refresh token
   kecuali sesi current** (keputusan Q3-A); cookie current tetap hidup.
8. `POST /auth/set-password` — `{new_password}` untuk akun **tanpa password**
   (Google-only). Tanpa current password. Berlaku sama: policy NIST +
   `password_changed_at`. Prasyarat sebelum unlink Google.
9. `GET /auth/sessions` — daftar sesi aktif (non-revoked, non-expired):
   id, user_agent, ip, created_at, expires_at, `current` (bool — sesi yang
   memakai refresh cookie ini).
10. `POST /auth/sessions/:id/revoke` — putus satu sesi (revoke refresh token
    by id). Sesi current boleh di-revoke (sesi mati pada request berikutnya);
    UI menandai "Sesi ini" dengan jelas.
11. `POST /auth/delete-account` — `{password}` (keputusan V2-A). Akun Google-only
    cukup konfirmasi dialog + sesi aktif (tanpa field password).
12. **Delete account = soft delete (keputusan V3)**:
    - User di-soft-delete (`deleted_at`) + **email dianonimkan**
      `deleted-{id}@bandjari.local` + name menjadi "Akun Terhapus" → email asli
      bebas untuk daftar ulang (unique constraint).
    - Konten milik user ikut soft delete: Song + Section + SectionPart +
      SoundSlot (cascade lunak mengikuti pola `DeleteSectionsBySongID` dkk) +
      Sample user.
    - **Row `user_providers` milik user DIHAPUS permanen** (`DeleteAllByUserID`)
      — mencegah akun Google yang sudah pernah terhubung terkunci permanen:
      bila row provider dibiarkan, `FindByProviderSubject` menemukan link lama
      ke user soft-deleted dan login Google akun itu tidak akan pernah berhasil
      lagi.
    - Seluruh refresh token di-revoke; cookie refresh dihapus.
    - **`audit_logs` DI-PERTAHANKAN** (jejak keamanan; `user_id` nullable tanpa
      FK constraint — aman).
    - **Template sistem (`user_id NULL`, `is_system_template=true`) TIDAK
      tersentuh.**
13. **Audit event baru** (tabel `audit_logs`): `profile_update`,
    `password_change`, `provider_link`, `provider_unlink`, `session_revoke`,
    `account_delete`.
14. `UserResponse` diperluas: tambah `has_password` (bool) + `providers`
    (array provider terhubung) agar UI tahu akun punya password & Google
    terhubung. `email_verified` sudah ada.

### Frontend (halaman Profile — keputusan Q1-C)
15. `ProfileView` dirombak menjadi 5 bagian (menggantikan placeholder
    "Segera hadir"):
    1. **Identitas** — avatar inisial, nama, email, badge role + **status
       verifikasi email** (chip ✓ / "Belum diverifikasi" + tombol kirim ulang,
       cooldown 60s — reuse `useResendCooldown`).
    2. **Edit Profil** — form nama (`PATCH /users`).
    3. **Keamanan** — form ganti password (akun ber-password) / form set
       password (akun Google-only); **Akun terhubung**: Google Terhubung/Tidak
       + tombol Link/Unlink.
    4. **Sesi Aktif** — daftar perangkat + tombol "Putuskan" per sesi; sesi
       sekarang diberi label "Sesi ini".
    5. **Zona Berbahaya** — hapus akun (dialog konfirmasi + field password
       bila akun ber-password).
16. Komponen baru: `EditNameForm`, `ChangePasswordForm`, `SetPasswordForm`,
    `ConnectedAccountsCard`, `SessionsCard`, `DeleteAccountDialog`.
    Konvensi UI mengikuti komponen yang ada (Button, Badge, ConfirmDialog,
    pola form `RegisterForm`).
17. Client API di-**regenerate via Orval** setelah Swagger diperbarui;
    endpoint non-generated memakai `customInstance` bila perlu.
18. Banner `VerifyEmailBanner` global (sudah ada di `_app.tsx`) tetap;
    status verifikasi di profile adalah chip ringkas, bukan duplikasi banner.

## Success Criteria (MUST ALL BE TRUE)

- [ ] `go test ./...` (API) lulus tanpa regresi — termasuk test perilaku login
      Google baru (subject match, fallback passwordless, tolak akun ber-password,
      backfill, link mode, unlink guard)
- [ ] Test change-password: password lama salah ditolak; sukses → revoke sesi
      lain, sesi current tetap hidup; `password_changed_at` terisi
- [ ] Test delete-account: konfirmasi password; soft delete + anonimisasi email;
      konten user ikut soft delete; template sistem tidak tersentuh;
      audit `account_delete` tercatat
- [ ] Test session list/revoke: hanya sesi aktif yang tampil, `current` benar,
      revoke by id bekerja, revoke sesi current → request berikutnya 401
- [ ] Test unlink: ditolak untuk akun Google-only (tanpa password); berhasil
      untuk akun ber-password; login Google setelah unlink → tolak
      (`GOOGLE_LINK_REQUIRED`)
- [ ] `tsc` + `biome` + `vitest` (test lama 108 tetap hijau) + `build` lulus
- [ ] Swagger & client Orval diperbarui; seeder admin tidak terpengaruh
- [ ] Smoke test manual: semua 5 bagian halaman Profile berfungsi

## Anti-Patterns (FORBIDDEN)

- ❌ **NO hard delete** (inconsistency: seluruh pola delete di codebase adalah
  soft delete; `sound_slots.sample_id` `OnDelete:RESTRICT` menghalangi
  hard-delete yang aman)
- ❌ **NO auto-link ulang Google untuk akun ber-password setelah unlink**
  (correctness: membuat fitur unlink tidak bermakna)
- ❌ **NO unlink untuk akun tanpa password** (security: akun kehilangan
  satu-satunya metode login → terkunci selamanya)
- ❌ **NO menghapus `audit_logs` saat delete account** (security/compliance:
  jejak keamanan adalah dasar hukum terpisah)
- ❌ **NO mengubah template sistem saat delete account** (integrity:
  `is_system_template=true` & `user_id NULL` adalah konten publik)
- ❌ **NO email/avatar change di iterasi ini** (scope: butuh verifikasi ulang
  & upload storage — di luar epik)
- ❌ **NO change-password tanpa verifikasi password lama** (security: OWASP
  re-authentication untuk aksi sensitif)
- ❌ **NO menyimpan `provider_subject` di tabel users** (design:
  tabel `user_providers` memungkinkan multi-provider & unlink bersih)
- ❌ **NO token access di localStorage** (security: konsisten E-AUTH-2026 R4)
- ❌ **NO respons error menghilangkan password lama di log** (security)

## Approach

Empat slice bertahap (task dibuat iteratif, TDD):

1. **Fondasi backend provider**: model `user_providers` + refactor OAuth service
   (match by subject, fallback passwordless, backfill) + link/unlink + audit.
2. **Keamanan akun**: `PATCH /users`, change-password, set-password, audit.
3. **Sesi & hapus akun**: session list/revoke, delete-account soft delete +
   anonimisasi + cascade konten.
4. **Frontend Profile**: 5 bagian halaman Profile + komponen + regenerate Orval.

Setiap slice diuji TDD (service/handler dengan fake repo, mengikuti pola
E-AUTH-2026), lalu frontend dengan vitest.

## Architecture

- `model/user_provider.go` — tabel `user_providers` (+ AutoMigrate di main.go)
- `repository/user_provider_repository.go` — FindByProviderSubject, FindByUser,
  Create, DeleteByProviderSubject, DeleteAllByUserID
- `repository/user_repository.go` — + `UpdateName(id, name)`, `AnonymizeForDelete(id)`
  (soft delete + email `deleted-{id}@bandjari.local` + name), `SetPasswordHash`
- `repository/refresh_token_repository.go` — + `ListActiveByUserID`,
  `FindByID`, `RevokeByID`, `RevokeAllByUserIDExcept(userID, exceptHash)`
- `service/oauth_service.go` — refactor `LoginOrCreateUser` (V1-A) +
  `LinkProvider(userID, provider, subject)`, `UnlinkProvider(userID, provider)`
- `service/user_service.go` — + `UpdateProfile(userID, name)`,
  `ChangePassword(userID, current, new)`, `SetPassword(userID, new)`,
  `DeleteAccount(userID, password, isGoogleOnly)`
- `service/session_service.go` — baru: `ListSessions(userID, currentHash)`,
  `RevokeSession(userID, id)`
- `handler/user_handler.go`, `handler/oauth_handler.go` — endpoint baru
- `main.go` — wiring + route baru
- Frontend: `ProfileView.tsx` + 6 komponen baru di `features/auth/components/`

Alur delete-account (transaksi):
```
verify password → revoke semua refresh token → soft delete konten user
(song→section→part→slot cascade lunak, sample) → soft delete user +
anonimisasi email/name → clear cookie → audit account_delete
```

## Design Rationale

### Problem
Halaman Profile hanya kartu identitas + placeholder "Segera hadir". Fitur
pengelolaan akun (edit nama, ganti password, link provider, kelola sesi, hapus
akun) belum ada padahal fondasi auth E-AUTH-2026 sudah menyediakan bahan
bakunya (refresh_tokens punya user_agent/ip, soft delete, audit, Google OAuth).

### Research Findings

**Codebase:**
- `model/base.go` — `BaseModel` sudah punya `gorm.DeletedAt` (soft delete tersedia)
- `repository/song_repository.go:112-129` — pola cascade soft-delete
  `DeleteSectionsBySongID` → `DeletePartsBySongID` → `DeleteSlotsBySongID`
- `model/sound_slot.go:16` — `SampleID` `OnDelete:RESTRICT` → hard delete sample
  berisiko
- `middleware/auth.go:95` — context menyediakan `user_id` dari DB (bukan klaim)
- `model/refresh_token.go` — punya `UserAgent` + `IP` (fondasi daftar sesi)
- `handler/user_handler.go` — `recordAudit` best-effort; 11 event auth
- `service/oauth_service.go` — `LoginOrCreateUser` match by email saja (tanpa
  rekam provider) → harus di-refactor untuk fitur unlink
- `features/auth/components/VerifyEmailBanner.tsx` — pola banner + cooldown
  sudah ada; `useResendCooldown` reusable
- `dto/nullable.go` — pola field optional untuk PATCH

**External:**
- OWASP ASVS V2 (authentication) — re-authentication untuk aksi sensitif
  (change password, delete account)
- GDPR Art. 17 (right to erasure) — praktik umum: soft delete + anonimisasi
  PII + retensi audit; mayoritas aplikasi produksi tidak hard delete langsung
- Google OAuth userinfo v2 — `id` = sub stable identifier, dipakai
  `provider_subject` (referensi: Google Identity Platform docs)

### Approaches Considered

#### 1. Soft delete + anonimisasi email (delete account) ✓
**What it is:** soft delete user + email → `deleted-{id}@bandjari.local` +
cascade lunak konten; audit dipertahankan.

**Pros:** konsisten dengan seluruh pola soft delete di codebase; reversible
dalam masa retensi; audit utuh; email bebas untuk daftar ulang.
**Cons:** data tidak langsung hilang permanen (butuh job purge di masa depan —
di luar scope).

**Chosen because:** keputusan V3 user + konsistensi codebase + praktik industri
(soft delete + anonimisasi).

#### 2. Hard delete permanen ❌
**Why we looked at this:** "right to erasure" yang literal.
**Investigation:** `sound_slots.sample_id` `OnDelete:RESTRICT` menghalangi
hard delete sample yang masih direferensikan; pola existing semua lunak;
tidak ada recovery.
**⚠️ REJECTED BECAUSE:** inkonsisten dengan codebase & berisiko data hilang
permanen karena salah konfirmasi. **DO NOT REVISIT UNLESS:** ada regulasi yang
mensyaratkan erasure permanen otomatis.

#### 3. Grace period (soft 30 hari → purge cron) ❌
**What it is:** soft delete + masa tenggang + job purge + alur "batalkan hapus".
**Why we looked at this:** pola paling "industri penuh" (Google/GitHub).
**Pros:** recovery terbaik. **Cons:** butuh cron + alur email pembatalan —
effort besar tanpa kebutuhan nyata di tahap ini.
**⚠️ REJECTED BECAUSE:** over-engineering untuk iterasi pertama; soft delete
tetap memungkinkan recovery manual via support.
**🚫 DO NOT REVISIT UNLESS:** volume penghapusan akun tinggi & regulasi
menuntut jadwal purge otomatis.

### Scope Boundaries

**In scope:**
- Status verifikasi email di profile (chip + kirim ulang)
- Edit nama (PATCH /users) — bukan email/avatar
- Change password (wajib password lama, revoke sesi lain) + set password
  untuk akun Google-only
- Connected accounts: link/unlink Google (model `user_providers`)
- Kelola sesi: daftar + revoke per sesi
- Delete account: soft delete + anonimisasi + cascade konten + audit
- Audit event baru + Swagger + client Orval + test TDD

**Out of scope (deferred/never):**
- Ganti email (butuh alur verifikasi email baru) — epik terpisah
- Avatar upload (butuh storage R2 + resize) — epik terpisah
- Provider OAuth lain (GitHub, Apple) — model sudah siap, alur menyusul
- MFA/passkeys — di luar (diputuskan di E-AUTH-2026)
- Purge cron untuk data soft-deleted — di luar
- Pengaturan lain (tema, bahasa) — bukan kebutuhan auth

### Open Questions
- Apakah `GET /users` perlu menampilkan `has_password`+`providers` langsung,
  atau cukup endpoint `GET /auth/sessions` terpisah? (default: perluas
  `UserResponse` — UI butuh status sekali fetch)
- Label sesi: cukup user_agent mentah atau perlu di-parse "Chrome di macOS"?
  (default: user_agent mentah + badge "Sesi ini")

## Design Discovery (Reference Context)

### Key Decisions Made

| Question | User Answer | Implication |
|----------|-------------|-------------|
| Q1 — Scope iterasi ini? | C (Lengkap) | Verifikasi + edit nama + ganti password + connected accounts + kelola sesi + delete account |
| Q2 — Edit profil? | A (Nama saja) | Email & avatar out of scope |
| Q3 — Ganti password? | A (wajib lama + revoke sesi lain) | Sesi current tetap hidup |
| Q4 — Connected accounts? | B (Link + unlink) | Perlu model `user_providers` + refactor OAuth |
| Q5 — Delete account? | B (Sekarang) | Masuk epik ini |
| V1 — Perilaku linking? | A (subject match + fallback passwordless) | Tolak login Google untuk akun ber-password belum link |
| V2 — Konfirmasi delete? | A (wajib password) | Google-only cukup dialog + sesi |
| V3 — Soft/hard delete? | Soft delete + anonimisasi | Audit dipertahankan; template sistem aman |

### Research Deep-Dives

#### OAuth Linking Semantics
**Question explored:** Bagaimana membuat unlink Google bermakna tanpa melanggar
perilaku login Google yang sudah ada?
**Sources:** codebase `oauth_service.go`, Google Identity Platform docs,
pola Auth0/GitHub.
**Findings:** match by email murni membuat unlink mustahil (auto-link ulang).
Solusi: match by `(provider, provider_subject)`; email-fallback hanya untuk akun
tanpa password (legacy Google-only); akun ber-password harus link eksplisit.
**Conclusion:** V1-A — perubahan perilaku kecil (user ber-password yang dulu
login Google via email kini harus link sekali), sebanding dengan fitur unlink
yang jujur.

#### Delete Account Semantics
**Question explored:** Soft vs hard delete; nasib data terkait.
**Sources:** codebase (BaseModel soft delete, cascade lunak song, RESTRICT
sound_slots), GDPR guidance.
**Findings:** seluruh delete lunak; template sistem `user_id NULL`; audit tanpa
FK constraint; email unique → wajib anonimisasi agar bisa daftar ulang.
**Conclusion:** soft delete + anonimisasi + cascade lunak konten; audit tetap.

### Open Concerns Raised

- "Bagaimana nasib song user setelah hapus akun?" → ikut soft delete
  (cascade lunak), template sistem aman; audit tetap
- "Apakah delete permanen?" → soft delete (reversible dalam retensi), tanpa
  purge cron di iterasi ini
