# TODO — Tindak Lanjut Review Role System

## Phase 1: Authorization Hardening

### Task 1: Revocation role (TTL atau cek DB)
**Description:** ✅ SELESAI — Opsi A: middleware JWTAuth memuat role dari DB (`userRepo.FindByEmail`) dan menimpa klaim token; user tidak ditemukan → 401. Tes `TestJWTAuth_RoleSyncedFromDB` membuktikan promosi/demosi langsung berlaku.
**Acceptance criteria:**
- [x] Bila opsi B: `user_handler.LoginUser` set `exp` 2 jam untuk role admin (1 jam? ikut keputusan), 24 jam tetap untuk user biasa
- [x] Bila opsi A: middleware memuat role dari DB dan menimpa klaim token
- [x] Tes middleware/handler yang relevan diperbarui
**Verification:**
- [ ] `go test ./...` di apps/api
- [ ] Build platform tetap hijau
- [ ] Manual: login admin, decode token, cek `exp` (atau ubah role di DB → token lama kehilangan admin bila opsi A)
**Dependencies:** None
**Files likely touched:** `apps/api/handler/user_handler.go`, `apps/api/middleware/auth.go` (opsi A)
**Estimated scope:** S

### Task 2: Unit test utility role
**Description:** ✅ SELESAI — `claims_test.go` kini menguji `GetCurrentUserRole` (default user, admin, nilai tak dikenal, tipe salah) dan `IsAdmin`.
**Acceptance criteria:**
- [x] Tidak diset → role `"user"`, `IsAdmin` false
- [x] Diset `"admin"` → `IsAdmin` true
- [x] Diset nilai tak dikenal → bukan admin, tetap dikembalikan apa adanya (atau default user sesuai implementasi)
**Verification:** `go test ./api/utility/...`
**Dependencies:** None
**Files likely touched:** `apps/api/utility/claims_test.go`
**Estimated scope:** XS

### Task 3: Dokumentasi role di TDD
**Description:** ✅ SELESAI — `docs/core/tdd.md` bertambah Bagian 6.9 (FR-ROLE): kolom `users.role`, sumber kebenaran role (DB di middleware), matriks akses admin/user/guest, payload template; tabel 4.2, 6.2, 6.7 ikut diperbarui.
**Acceptance criteria:**
- [x] TDD memuat skema `users.role` & nilai yang valid
- [x] Matriks akses template (admin vs user) tercantum
- [x] Keputusan revocation (cek DB di middleware) terdokumentasi
**Verification:** Tidak ada — dokumentasi; review cepat oleh user
**Dependencies:** Task 1 (agar TTL yang tertulis sesuai implementasi)
**Files likely touched:** `docs/core/tdd.md`
**Estimated scope:** S

## Phase 2: Guard Coverage

### Task 4: Tes positif admin untuk guard SectionPart & SoundSlot
**Description:** ✅ SELESAI — `TestUpdateSteps_TemplateSongAdminAllowed` + `TestSlotRole_AdminCanMutateTemplate` (create/update/delete template oleh admin & penolakan non-admin) ditambahkan.
**Acceptance criteria:**
- [x] `UpdateSteps` pada part milik song template: non-admin → `ErrForbidden`; admin → sukses
- [x] `SoundSlot.Create/Update/Delete` pada part song template: non-admin → `ErrForbidden`; admin → sukses
- [x] Tes memakai pola fake yang ada (`setupPartEnv`/`setupSlotEnv` dengan song template)
**Verification:** `go test ./apps/api/service/...`
**Dependencies:** None
**Files likely touched:** `apps/api/service/section_part_service_test.go`, `apps/api/service/sound_slot_service_test.go`
**Estimated scope:** S

## Phase 3: UX & Polish

### Task 5: Navigasi buat Song Template → /templates/$songId
**Description:** ✅ SELESAI — `SongListView.handleSubmit` mengarahkan ke `/templates/$songId` bila `is_system_template`, else `/songs/$songId`.
**Acceptance criteria:**
- [x] Admin buat template → diarahkan ke halaman template (banner Mode Admin)
- [x] Buat song biasa → tetap ke `/songs/$songId`
**Verification:** build platform; manual: buat template lewat UI
**Dependencies:** None
**Files likely touched:** `apps/platform/src/features/song/components/SongListView.tsx`
**Estimated scope:** XS

### Task 6: readOnly rute /songs/$songId untuk template non-admin
**Description:** ✅ SELESAI — `readOnly={song.is_system_template && !isAdmin}`.
**Acceptance criteria:**
- [x] Non-admin membuka /songs/:id template → mode lihat-saja (kontrol edit tersembunyi)
- [x] Admin membuka /songs/:id template → tetap bisa edit (atau diarahkan ke /templates)
- [x] Song milik user → tidak berubah
**Verification:** build platform; manual cek 2 akun
**Dependencies:** None
**Files likely touched:** `apps/platform/src/routes/songs.$songId.index.tsx`
**Estimated scope:** XS

### Task 7: Reset asTemplate saat form upload sample ditutup
**Description:** ✅ SELESAI — `setAsTemplate(false)` saat Batal/menutup form.
**Acceptance criteria:**
- [x] Checkbox "Sample Template System" tidak tertinggal tercentang di batch berikutnya
**Verification:** build platform; manual: buka-tutup form upload
**Dependencies:** None
**Files likely touched:** `apps/platform/src/features/sample/components/SampleLibraryView.tsx`
**Estimated scope:** XS

### Task 8: Role optimistik dari LoginUserResponse
**Description:** ✅ SELESAI — `AuthContext.login(token, role?)` menyimpan role di localStorage (dibersihkan saat logout); `isAdmin` memakai profile dulu, fallback ke role login; `LoginForm` meneruskan `response.data.role`.
**Acceptance criteria:**
- [x] `AuthContext.login` menerima role opsional dan menyimpannya (localStorage) sehingga `isAdmin` tersedia segera setelah login
- [x] Logout membersihkan role tersimpan
**Verification:** build + test platform; manual: login admin → UI admin langsung tampil
**Dependencies:** None
**Files likely touched:** `apps/platform/src/features/auth/AuthContext.tsx`, `apps/platform/src/routes/login.tsx`
**Estimated scope:** S

## Phase 4: Deferred

### Task 9 (opsional): Tes UI frontend kontrol admin
**Description:** Setup vitest + testing-library (bila belum ada) dan tes komponen: checkbox template di SongListView/SampleLibraryView, aksi kartu sample template untuk admin.
**Acceptance criteria:** [didefinisikan saat dikerjakan]
**Dependencies:** Tasks 5–8
**Estimated scope:** L (dipecah saat dikerjakan)

## Checkpoints
- **Setelah Task 1–3:** `go test ./...` + build platform hijau; TDD mutakhir.
- **Setelah Task 4:** semua guard punya tes positif & negatif.
- **Setelah Task 5–8:** build + tes hijau; alur admin end-to-end diuji manual (buat template, kelola sample template, buka template).
