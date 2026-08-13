# Product Requirements Document (PRD)
## BandJari — Fase 1 (MVP)

| | |
|---|---|
| **Dokumen** | Product Requirements Document (PRD) |
| **Produk** | BandJari |
| **Cakupan** | Fase 1 / MVP — Fondasi Pattern Rebana |
| **Versi** | 1.0 |
| **Status** | Draft |
| **Dokumen Terkait** | [BRD](./BRD-bandjari.md) · [Dokumen Konsep](./bandjari-konsep.md) |

> *"BandJari" — bermain musik selayaknya sebuah band, cukup dengan jari.*

---

## 1. Ringkasan Produk

PRD ini merinci kebutuhan produk untuk **Fase 1 (MVP)**: aplikasi web yang memungkinkan pengguna menyusun pola pukulan rebana Al-Banjari (4 rebana + 1 bass) dalam bentuk pattern per bagian lagu (section), lalu memicunya secara live dengan mekanisme **clip launcher** — bukan drum pad konvensional.

Sejak revisi ini, produk mendukung **akses tanpa login (guest)** secara terbatas — pengunjung dapat langsung mencoba Launcher Mode dan melihat (bukan mengedit) Sequencer Mode untuk **Song Template System** (Song bawaan platform dengan susunan Section standar Al-Banjari, sudah terisi Sample), sebelum memutuskan untuk mendaftar. Kemampuan membuat/mengedit Song, Section, steps, dan Sample tetap memerlukan login — lihat Bagian 5.0 dan 6.8.

Fitur di luar cakupan ini (breakdown audio otomatis, sharing komunitas, dukungan vokal) dijelaskan pada Bagian 12 sebagai referensi arah produk, namun **tidak dirinci** pada dokumen ini — akan menjadi PRD terpisah pada fase berikutnya.

---

## 2. Tujuan Produk (Fase 1)

1. Pengguna dapat membuat lagu (Song) dan menyusun bagian-bagiannya (Section) secara bebas/dinamis
2. Pengguna dapat menyusun rumus pukulan (T/D) untuk masing-masing dari 5 instrumen (4 rebana + 1 bass) di tiap section
3. Pengguna dapat mengunggah sample audio asli untuk tiap bunyi (Tak & Dung) per instrumen, dan menggunakannya ulang di section lain
4. Pengguna dapat memutar (trigger) section sebagai pattern yang loop secara live, dengan transisi antar section yang musikal (tidak terpotong paksa)

---

## 3. Definisi & Terminologi

| Istilah | Definisi |
|---|---|
| **Song** | Satu unit lagu Al-Banjari, punya BPM dasar (default) dan kumpulan Section. Terdiri dari dua sumber kepemilikan: **Song milik User** (dibuat pengguna sendiri) dan **Song Template System** (lihat baris berikutnya) |
| **Song Template System** | *(baru)* Song bawaan yang disediakan oleh platform (bukan dibuat User), dimiliki oleh System — bersifat **read-only** bagi seluruh User, sudah memiliki susunan Section standar Al-Banjari (mis. Awalan, Dasar, Naik, Turun, Penutup) beserta `steps` dan Sample yang sudah terisi. Dapat dimainkan (Launcher Mode) dan dilihat (Sequencer Mode, read-only) oleh **Guest** sekalipun (lihat baris berikutnya) — berfungsi sebagai demo langsung agar pengunjung baru dapat merasakan produk tanpa perlu mendaftar terlebih dahulu |
| **Guest** | *(baru)* Pengunjung yang belum login/registrasi. Dapat memainkan Launcher Mode dan melihat (read-only) Sequencer Mode **khusus untuk Song Template System** — tidak dapat mengakses Song milik User manapun, dan tidak dapat melakukan aksi apapun yang mengubah data (buat Song/Section, edit steps/SoundSlot, upload Sample). Lihat Bagian 5.0 dan 6.8 |
| **Section** | Bagian dari sebuah Song (misal "Awalan", "Dasar", "Naik"), bersifat dinamis — nama dan jumlahnya bebas ditentukan pengguna, punya urutan tampil (orderIndex) dan **BPM override opsional** (lihat baris berikutnya) |
| **BPM Override** | *(baru)* Nilai BPM yang secara khusus berlaku untuk satu Section, menggantikan BPM dasar Song selama Section tsb diputar. Bersifat opsional (nullable) — jika kosong, Section mengikuti BPM dasar Song. Merepresentasikan kenyataan bahwa tempo antar bagian lagu Al-Banjari (mis. "Dasar Lambat" vs "Naik") bisa berbeda, meski tidak selalu |
| **Part** | Instrumen dalam formasi Al-Banjari murni. Bersifat **tetap**, terdiri dari 5 nilai: `rebana1`, `rebana2`, `rebana3`, `rebana4`, `bass` |
| **SectionPart** | Wadah pukulan untuk satu kombinasi Section × Part. Satu Section selalu punya tepat 5 SectionPart (satu per Part). Menyimpan `steps` (rumus pukulan) dan memiliki kumpulan **SoundSlot** |
| **SoundSlot** | *(baru)* Definisi satu jenis bunyi pukulan milik satu SectionPart (mis. "Tak", "Dung", "Duk"). Bersifat **dinamis** — jumlah dan nama bebas ditentukan pengguna per SectionPart (bisa berbeda antar Part, dan berbeda antar Section untuk Part yang sama). Setiap SoundSlot punya: label (nama tampilan), key (1 karakter unik pilihan pengguna, dipakai dalam `steps`), dan referensi ke satu Sample |
| **Steps** | Rumus pukulan dalam bentuk string, panjang bebas, merepresentasikan urutan pukulan dalam satu siklus/loop Section. Setiap karakter dalam string merujuk ke `key` salah satu SoundSlot milik SectionPart yang sama — **bukan lagi terbatas pada `T`/`D` tetap** |
| **Sample** | File audio yang direferensikan oleh satu atau lebih SoundSlot. Bersifat reusable — bisa direferensikan lintas SoundSlot, SectionPart, bahkan lintas Song. Terdiri dari dua sumber kepemilikan: **Sample milik User** (upload pengguna sendiri) dan **Sample Template System** (lihat baris berikutnya) |
| **Sample Template System** | *(baru)* Sample bawaan yang disediakan oleh platform (bukan diupload User), dimiliki oleh System — bersifat **read-only** bagi seluruh User (tidak dapat diedit/dihapus oleh User manapun), namun dapat dipakai/direferensikan oleh SoundSlot milik User manapun. Berfungsi sebagai isian default agar User baru dapat langsung mencoba fitur playback tanpa perlu upload sample sendiri terlebih dahulu |
| **Pattern Launcher / Clip Launcher** | Mode pemutaran di mana tiap Section berfungsi sebagai "pad" yang bila dipicu akan me-loop seluruh SectionPart di dalamnya secara bersamaan, hingga pengguna memicu Section lain |
| **Quantized Trigger** | Mekanisme perpindahan antar Section yang aktif menunggu titik ketukan valid (umumnya akhir siklus/bar) sebelum benar-benar berpindah, agar transisi terdengar musikal |

> **Catatan perubahan dari versi PRD sebelumnya:** Definisi awal "Sample = satu bunyi `T` atau `D`" bersifat terlalu kaku terhadap realita di lapangan — dinamika pukulan rebana/bass sesungguhnya bisa memiliki lebih dari 2 jenis bunyi (mis. "Duk" sebagai tambahan dari Tak/Dung). Model **SoundSlot** menggantikan pasangan kolom tetap `sampleTakId`/`sampleDungId`, mengikuti pola yang sama seperti Section (dinamis, bukan enum tetap) — lihat Bagian 10 untuk detail keputusan.

---

## 4. Persona Pengguna

| Persona | Deskripsi Singkat | Tujuan Menggunakan Produk |
|---|---|---|
| **Vokalis Mandiri** | Individu dengan minat vokal Al-Banjari, tidak punya rekan pemain rebana lengkap | Menyusun & memutar iringan rebana untuk latihan/berkarya mandiri |
| **Pemain Rebana / Pelatih Grup** | Anggota grup Al-Banjari yang terbiasa menyusun variasi pukulan | Mendigitalkan & mendokumentasikan variasi pukulan grup sendiri, mempermudah pelatihan anggota baru |

---

## 5. Alur Pengguna Utama (Core User Flows)

### 5.0 Flow: Akses Guest (Belum Login) — *(baru)*

```
1. Pengunjung membuka aplikasi TANPA login
2. System menampilkan daftar Song Template System (bukan Song milik User manapun)
3. Guest memilih salah satu Song Template System
4. Guest dapat langsung membuka Launcher Mode dan memainkan Song tsb — Section sudah
   tersusun standar Al-Banjari, steps & Sample sudah terisi, tidak perlu setup apapun
5. Guest juga dapat membuka Sequencer Mode untuk Song tsb, dalam mode LIHAT SAJA
   (read-only) — dapat melihat susunan steps & SoundSlot, TIDAK dapat mengedit
6. Jika Guest mencoba melakukan aksi yang membutuhkan login (edit steps, tambah Section,
   upload Sample, buat Song baru, dsb), System menampilkan prompt "Login untuk edit" pada
   tempat yang sama (bukan redirect paksa ke halaman lain) — Guest dapat mengabaikan
   prompt tsb dan melanjutkan menjelajah/memainkan dalam mode terbatas
7. Guest dapat login/registrasi kapan saja melalui prompt tsb atau tombol login di navigasi
```

> **Catatan penting:** Guest **tidak dapat** mengakses Song milik User manapun — hanya Song Template System yang dapat dilihat/dimainkan tanpa login. Ini berbeda dari Sample Template System (Bagian 5.3) yang dapat direferensikan oleh SoundSlot **milik User manapun** setelah login — Song Template System murni untuk kebutuhan demo/preview bagi Guest yang belum mendaftar.

### 5.1 Flow: Membuat Lagu & Menyusun Section

```
1. User login/registrasi
2. User membuat Song baru (input: nama, BPM dasar)
3. System otomatis mengarahkan ke halaman detail Song (kosong, belum ada Section)
4. User menambah Section baru (input: nama section, mis. "Awalan")
5. System otomatis membuat 5 SectionPart untuk Section tsb (rebana1-4, bass). Tiap SectionPart
   otomatis mendapat SoundSlot default (mis. "Tak"/key `T`, "Dung"/key `D`) yang **langsung terpasang
   Sample Template System** sesuai Part-nya — Section baru langsung bisa diputar/didengar tanpa User
   perlu upload apapun terlebih dahulu (lihat FR-SLOT-09, FR-SAMP-11)
6. (Opsional) User menetapkan BPM override khusus untuk Section tsb, apabila tempo bagian
   ini berbeda dari BPM dasar Song (mis. Section "Dasar Lambat" diberi BPM lebih rendah)
7. User mengulangi langkah 4-6 untuk section lain sesuai kebutuhan (Dasar, Naik, Turun, dst — bebas)
8. User dapat mengatur ulang urutan Section (drag & drop atau kontrol naik/turun)
```

> **Catatan:** BPM override bersifat opsional per Section — tidak semua Section perlu diisi. Section tanpa override otomatis mengikuti BPM dasar Song, merepresentasikan kenyataan bahwa tempo antar bagian lagu Al-Banjari bisa sama atau berbeda, tergantung aransemen masing-masing grup.

### 5.2 Flow: Mengelola Jenis Bunyi & Mengisi Pola Pukulan (Sequencer Mode)

```
1. User membuka salah satu Section dari Song
2. User memilih salah satu Part (rebana1/2/3/4/bass) untuk diedit — sistem menampilkan SectionPart terkait
3. User menambah satu atau lebih SoundSlot untuk SectionPart tsb:
   a. Input: label (nama bebas, mis. "Tak", "Dung", "Duk")
   b. Input: key — 1 karakter unik pilihan user (mis. "T", "D", "K"), dipakai merepresentasikan
      bunyi ini di dalam rumus steps
   c. (Opsional) Pilih Sample dari library untuk SoundSlot tsb — bisa memilih Sample Template
      System (bawaan platform, read-only) atau Sample milik User sendiri
4. User mengulangi langkah 3 untuk menambah SoundSlot lain pada SectionPart yang sama
   — jumlah SoundSlot per SectionPart bebas/dinamis, tidak terbatas pada 2
5. User memasukkan/mengedit rumus steps melalui step editor — tiap step merujuk ke salah satu
   key SoundSlot yang telah didefinisikan pada SectionPart tsb
6. User menyimpan perubahan
7. (Opsional) User memutar preview Section tsb untuk mendengar hasil sementara
   — SoundSlot yang belum diganti User tetap memakai Sample Template System bawaan
```

> **Catatan:** SoundSlot default yang dibuat otomatis (langkah sebelumnya di Flow 5.1) sudah terpasang Sample Template System sejak awal — bukan kosong. User bebas menggantinya dengan Sample sendiri, memilih Sample Template System lain, atau mengosongkannya kapan saja.

> **Catatan:** SoundSlot didefinisikan **per SectionPart** (bukan per Song atau per Part secara global) — sehingga Rebana 1 di Section "Awalan" bisa punya 2 SoundSlot (Tak, Dung), sementara Rebana 1 di Section "Naik" bisa punya 3 SoundSlot (Tak, Dung, Duk), sesuai kebutuhan variasi masing-masing bagian lagu.

### 5.3 Flow: Mengelola Sample Audio

```
1. User membuka halaman manajemen Sample — menampilkan dua bagian:
   a. "Sample Saya" — library pribadi User (dapat diedit/dihapus)
   b. "Sample Bawaan" — daftar Sample Template System (read-only, tidak dapat diedit/dihapus User)
2. User mengunggah file audio, menentukan: nama, Part terkait — tersimpan sebagai Sample miliknya
3. Sample tersimpan di library User (lepas dari Song/Section/SoundSlot manapun)
4. Saat mengedit SoundSlot pada suatu SectionPart, user memilih Sample dari salah satu daftar
   (Sample Saya atau Sample Bawaan) untuk mengisi slot audio SoundSlot tsb
5. Sample yang sama dapat dipilih ulang di SoundSlot lain — pada SectionPart yang sama,
   SectionPart lain, bahkan Song lain (reuse penuh, tanpa upload ulang). Berlaku untuk
   Sample Saya maupun Sample Bawaan
```

> **Catatan perubahan:** Sample tidak lagi mewajibkan atribut "jenis bunyi" (`T`/`D`) saat upload — karena jenis bunyi kini didefinisikan di level SoundSlot (dinamis), bukan atribut tetap pada Sample itu sendiri. Satu Sample cukup terikat ke Part; asosiasinya ke jenis bunyi tertentu ditentukan saat Sample tsb dipasangkan ke sebuah SoundSlot.

### 5.4 Flow: Mode Launcher (Playback Live)

```
1. User membuka Song dalam mode Launcher
2. System menampilkan grid pad dinamis — satu pad per Section, sejumlah Section yang ada
3. User menekan salah satu pad Section
4. System memulai playback: seluruh 5 SectionPart pada Section tsb diputar berulang (loop)
   sesuai steps & sample masing-masing, mengikuti BPM Song
5. User menekan pad Section lain
6. System menunggu titik ketukan valid (akhir siklus Section aktif), lalu:
   - Menghentikan Section sebelumnya
   - Memulai Section baru
7. User dapat menghentikan playback kapan saja (tombol Stop)
```

---

## 6. Kebutuhan Fungsional (Functional Requirements)

Diberi kode `FR-<Modul>-<Nomor>` dan prioritas menggunakan **MoSCoW** (Must have / Should have / Could have / Won't have — untuk fase ini).

### 6.1 Modul: Manajemen Song

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-SONG-01 | Sistem harus memungkinkan User membuat Song baru dengan input nama dan BPM | Must |
| FR-SONG-02 | Sistem harus memungkinkan satu User memiliki banyak Song | Must |
| FR-SONG-03 | Sistem harus memungkinkan User mengedit nama dan BPM Song yang sudah ada | Must |
| FR-SONG-04 | Sistem harus memungkinkan User menghapus Song beserta seluruh Section & SectionPart di dalamnya (cascade delete) | Must |
| FR-SONG-05 | Sistem harus menampilkan daftar seluruh Song milik User yang sedang login | Must |
| FR-SONG-06 | Sistem should memungkinkan User menduplikasi (duplicate/clone) Song yang sudah ada sebagai starting point Song baru | Should |
| FR-SONG-07 | Sistem harus menyediakan minimal satu **Song Template System** — Song bawaan platform dengan susunan Section standar Al-Banjari, `steps`, dan Sample yang sudah lengkap terisi | Must |
| FR-SONG-08 | Song Template System harus **read-only** — tidak dapat diedit atau dihapus oleh User maupun Guest manapun (dikelola lewat mekanisme seeding, bukan endpoint yang dapat diakses publik) | Must |
| FR-SONG-09 | Sistem harus menampilkan daftar Song Template System secara terpisah dari daftar Song milik User (mis. sebagai halaman/tab tersendiri) | Must |
| FR-SONG-10 | Sistem should memungkinkan User (setelah login) menduplikasi Song Template System sebagai starting point Song miliknya sendiri, agar dapat dimodifikasi bebas | Should |

### 6.2 Modul: Manajemen Section

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-SEC-01 | Sistem harus memungkinkan User menambah Section baru ke dalam Song, dengan nama bebas (bukan enum tetap) | Must |
| FR-SEC-02 | Saat Section baru dibuat, sistem harus otomatis membuat 5 SectionPart kosong (satu per Part: rebana1, rebana2, rebana3, rebana4, bass) | Must |
| FR-SEC-03 | Sistem harus memungkinkan User mengubah nama Section yang sudah ada | Must |
| FR-SEC-04 | Sistem harus memungkinkan User mengatur ulang urutan tampil Section (orderIndex) dalam satu Song | Must |
| FR-SEC-05 | Sistem harus memungkinkan User menghapus Section beserta seluruh SectionPart di dalamnya | Must |
| FR-SEC-06 | Sistem harus memungkinkan jumlah Section dalam satu Song bersifat tidak terbatas (dinamis), **tanpa batas maksimum praktis** — keputusan final, lihat Bagian 10 | Must |
| FR-SEC-07 | Sistem should memungkinkan User menduplikasi Section dalam Song yang sama sebagai starting point variasi baru | Should |
| FR-SEC-08 | Sistem harus memungkinkan User menetapkan BPM override khusus untuk suatu Section, terpisah dari BPM dasar Song | Must |
| FR-SEC-09 | Sistem harus memungkinkan BPM override Section tetap kosong (tidak diisi) — apabila kosong, Section mengikuti BPM dasar Song saat diputar | Must |

### 6.3 Modul: SoundSlot (Jenis Bunyi per SectionPart)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-SLOT-01 | Sistem harus memungkinkan User menambah SoundSlot baru pada suatu SectionPart, dengan input: label (nama bebas) dan key (1 karakter, dipilih User) | Must |
| FR-SLOT-02 | Sistem harus memvalidasi bahwa key SoundSlot **unik dalam lingkup SectionPart yang sama** (dua SoundSlot pada SectionPart yang sama tidak boleh punya key sama) | Must |
| FR-SLOT-03 | Sistem harus memungkinkan jumlah SoundSlot per SectionPart bersifat dinamis — tidak dibatasi hanya 2 (Tak/Dung), dan boleh berbeda jumlah antar SectionPart (termasuk antar Section untuk Part yang sama) | Must |
| FR-SLOT-04 | Sistem harus memungkinkan User mengubah label dan/atau key SoundSlot yang sudah ada | Must |
| FR-SLOT-05 | Sistem harus memungkinkan User menghapus SoundSlot; sistem harus **menolak penghapusan** apabila `key` SoundSlot tsb masih dipakai di dalam `steps` SectionPart yang sama (lihat FR-SLOT-06) | Must |
| FR-SLOT-06 | Sistem harus **menolak permintaan penghapusan atau perubahan `key`** SoundSlot selama `key` tersebut masih dipakai di dalam `steps` SectionPart terkait — konsisten dengan pola penanganan Sample (FR-SAMP-08). User wajib membersihkan/mengganti step yang memakai key tsb terlebih dahulu — keputusan final, lihat Bagian 10 | Must |
| FR-SLOT-07 | Sistem harus memungkinkan User memilih satu Sample dari library untuk dipasangkan ke suatu SoundSlot | Must |
| FR-SLOT-08 | Sistem harus memungkinkan SoundSlot tanpa Sample terpasang (kosong) tanpa menghalangi penyimpanan | Must |
| FR-SLOT-09 | Sistem harus menyediakan minimal satu SoundSlot default (mis. berlabel "Tak"/"Dung" dengan key `T`/`D`) secara otomatis saat SectionPart pertama kali dibuat, sebagai starting point yang dapat diubah/ditambah User — mengurangi friksi di alur onboarding. SoundSlot default tsb harus **langsung terpasang Sample Template System** yang sesuai (bukan kosong) apabila tersedia untuk Part & jenis bunyi terkait (lihat FR-SAMP-11) | Must |

### 6.4 Modul: Sequencer (Pengisian Pola Pukulan)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-SEQ-01 | Sistem harus menampilkan editor step untuk mengisi/mengubah `steps` per SectionPart | Must |
| FR-SEQ-02 | Sistem harus memvalidasi bahwa setiap karakter dalam `steps` merujuk ke key salah satu SoundSlot yang terdaftar pada SectionPart yang sama — karakter di luar itu ditolak | Must |
| FR-SEQ-03 | Sistem harus mendukung `steps` dengan panjang bebas/dinamis, **tanpa batas maksimum panjang praktis** — keputusan final, lihat Bagian 10 | Must |
| FR-SEQ-04 | Sistem harus memungkinkan `steps` kosong (belum diisi) tanpa menghalangi penyimpanan Section | Must |
| FR-SEQ-05 | Sistem harus menyediakan preview audio saat mengedit steps (memutar pattern part tsb secara individual) | Must |
| FR-SEQ-06 | Sistem could menyediakan visualisasi notasi (misal highlight tiap key SoundSlot dengan warna berbeda) untuk mempermudah pembacaan pola | Could |

### 6.5 Modul: Manajemen Sample Audio

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-SAMP-01 | Sistem harus memungkinkan User mengunggah file audio sebagai Sample baru | Must |
| FR-SAMP-02 | Saat upload, sistem harus mewajibkan User menentukan: nama sample, Part terkait (salah satu dari 5 enum) | Must |
| FR-SAMP-03 | Sistem harus menyimpan Sample sebagai entitas independen milik User (bukan milik Song/Section/SoundSlot tertentu) | Must |
| FR-SAMP-04 | Sistem harus memungkinkan satu Sample direferensikan oleh banyak SoundSlot (lintas SectionPart maupun lintas Song) tanpa duplikasi file | Must |
| FR-SAMP-05 | Sistem harus memungkinkan User memilih Sample dari library miliknya untuk dipasangkan ke suatu SoundSlot (lihat FR-SLOT-07) | Must |
| FR-SAMP-06 | Sistem harus memvalidasi format & ukuran file audio yang diunggah: **hanya format `.wav`, ukuran maksimum 5MB per file** — keputusan final, lihat Bagian 10 | Must |
| FR-SAMP-07 | Sistem harus memungkinkan SoundSlot tanpa Sample terpasang (kosong) tanpa menghalangi penggunaan Section | Must |
| FR-SAMP-08 | Sistem harus **menolak permintaan penghapusan Sample** selama Sample tersebut masih direferensikan oleh SoundSlot manapun; User harus melepas seluruh referensi terlebih dahulu sebelum Sample dapat dihapus — keputusan final, lihat Bagian 10 | Must |
| FR-SAMP-09 | Sistem should memungkinkan User mengganti nama atau menghapus Sample yang tidak lagi digunakan | Should |
| FR-SAMP-10 | Sistem harus memungkinkan User mengosongkan referensi Sample pada suatu SoundSlot (set ke kosong) sebagai langkah untuk melepas ketergantungan sebelum Sample terkait dapat dihapus (mendukung FR-SAMP-08) | Must |
| FR-SAMP-11 | Sistem harus menyediakan **Sample Template System** — kumpulan Sample bawaan platform (bukan upload User), mencakup minimal bunyi Tak dan Dung untuk kelima Part (rebana1-4, bass) | Must |
| FR-SAMP-12 | Sample Template System harus **read-only** bagi seluruh User — tidak dapat diedit nama atau dihapus oleh User manapun | Must |
| FR-SAMP-13 | Sample Template System harus dapat direferensikan (dipasangkan ke SoundSlot) oleh User manapun, setara dengan Sample milik User sendiri dari sisi fungsi playback | Must |
| FR-SAMP-14 | Sistem harus menampilkan Sample Template System dan Sample milik User sebagai dua kelompok yang jelas terpisah pada UI pemilihan/manajemen Sample, agar User dapat membedakan mana yang bisa diedit/dihapus dan mana yang tidak | Must |

### 6.6 Modul: Pattern Launcher (Playback)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-PLAY-01 | Sistem harus menampilkan satu pad per Section dalam mode Launcher, jumlah pad menyesuaikan jumlah Section secara dinamis | Must |
| FR-PLAY-02 | Sistem harus memulai playback loop seluruh 5 SectionPart dalam satu Section secara bersamaan saat pad-nya dipicu | Must |
| FR-PLAY-03 | Sistem harus memutar bunyi sesuai `steps` masing-masing SectionPart — tiap karakter step memicu Sample dari SoundSlot yang key-nya cocok — mengikuti BPM Section yang sedang aktif (BPM override Section jika diisi, atau BPM dasar Song jika tidak — lihat FR-SEC-08/09) | Must |
| FR-PLAY-04 | Sistem harus menerapkan **quantized trigger**: saat berpindah pad, Section aktif tidak berhenti seketika, melainkan menunggu titik akhir siklus sebelum beralih ke Section baru | Must |
| FR-PLAY-05 | Sistem harus menggunakan mekanisme scheduling presisi (lookahead scheduling via Web Audio API) agar playback tidak drift/telat, termasuk saat tab browser tidak fokus | Must |
| FR-PLAY-06 | Sistem harus menyediakan kontrol Stop untuk menghentikan seluruh playback | Must |
| FR-PLAY-07 | Sistem harus menampilkan indikator visual section mana yang sedang aktif/playing | Must |
| FR-PLAY-08 | Sistem should menampilkan indikator posisi step yang sedang berjalan dalam siklus Section aktif | Should |
| FR-PLAY-09 | Jika suatu step dalam `steps` merujuk ke SoundSlot yang belum memiliki Sample terpasang (kosong), sistem harus tetap dapat playback tanpa error — step tsb diperlakukan sebagai senyap (silent), bukan memutar suara lain sebagai pengganti | Must |
| FR-PLAY-10 | Sistem could menyediakan kontrol volume per Part saat playback (mis. mute/unmute sementara salah satu rebana) | Could |
| FR-PLAY-11 | Apabila BPM Section baru (hasil quantized trigger) berbeda dari BPM Section sebelumnya, sistem harus menerapkan perubahan tempo **secara langsung/seketika (hard cut)** tepat saat Section baru mulai — bukan transisi bertahap (ramp/gradual) — keputusan final, lihat Bagian 10 | Must |

### 6.7 Modul: Autentikasi & Kepemilikan Data

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-AUTH-01 | Sistem harus mewajibkan User login untuk mengakses fitur pembuatan/pengeditan Song, Section, SectionPart, SoundSlot, dan Sample | Must |
| FR-AUTH-02 | Sistem harus memastikan Song, Section, SectionPart, dan Sample milik User hanya dapat diakses/diedit oleh User pemiliknya | Must |
| FR-AUTH-03 | Sistem should menyediakan mekanisme registrasi mandiri (self sign-up) | Should |
| FR-AUTH-04 | Sistem harus memungkinkan **Guest** (belum login) mengakses Launcher Mode dan Sequencer Mode (read-only) **khusus untuk Song Template System**, tanpa memerlukan login — keputusan final, lihat Bagian 10 | Must |
| FR-AUTH-05 | Sistem harus **menolak** akses Guest ke Song milik User manapun (bukan Song Template System), baik di Launcher Mode maupun Sequencer Mode | Must |
| FR-AUTH-06 | Sistem harus mencegah Guest melakukan aksi apapun yang mengubah data (create/update/delete pada Song, Section, SectionPart, SoundSlot, Sample) — termasuk terhadap Song Template System, yang bersifat read-only bagi siapapun selain melalui mekanisme seeding (konsisten dengan pola Sample Template System, FR-SAMP-12) | Must |
| FR-AUTH-07 | Saat Guest mencoba melakukan aksi yang membutuhkan login, sistem harus menampilkan prompt "Login untuk edit" pada tempat yang sama (bukan redirect paksa), dan mengizinkan Guest melanjutkan menjelajah dalam mode terbatas apabila prompt diabaikan — keputusan final, lihat Bagian 10 | Must |

---

## 7. Kebutuhan Non-Fungsional (Non-Functional Requirements)

| Kode | Kategori | Kebutuhan |
|---|---|---|
| NFR-01 | Performa Playback | Timing playback harus presisi (idealnya deviasi <10ms dari BPM yang ditentukan), tidak drift meski Section berjalan dalam durasi lama |
| NFR-02 | Kompatibilitas Browser | Fitur playback (Web Audio API) harus berjalan pada browser modern (Chrome, Firefox, Safari, Edge versi terkini) |
| NFR-03 | Ketahanan saat Tab Background | Playback tidak boleh berhenti/tersendat saat tab browser tidak dalam fokus (diselesaikan lewat Web Worker sebagai clock, bukan `setInterval`) |
| NFR-04 | Keamanan Data | Data Song/Section/Sample milik satu User tidak boleh dapat diakses/dimodifikasi User lain tanpa otorisasi |
| NFR-05 | Validasi Input | Seluruh input `steps` divalidasi di sisi backend (bukan hanya frontend) untuk mencegah data tidak valid tersimpan |
| NFR-06 | Skalabilitas Storage Sample | Penyimpanan file sample audio harus mempertimbangkan pertumbuhan volume seiring bertambahnya User (strategi storage dirinci di spesifikasi teknis) |
| NFR-07 | Aksesibilitas Perangkat | UI Launcher Mode harus dapat dioperasikan dengan baik pada layar sentuh (tablet/mobile), mengingat potensi penggunaan saat latihan/tampil langsung |
| NFR-08 | Konsistensi Data | Penghapusan Song harus konsisten menghapus seluruh Section & SectionPart terkait (tidak menyisakan data yatim/orphan) |

---

## 8. Cakupan Data (Ringkasan Model)

> Detail skema data lengkap (model GORM, relasi, tipe kolom) mengacu pada TDD Bagian 4–5. Berikut ringkasan entitas dari perspektif produk:

| Entitas | Dimiliki Oleh | Sifat Utama |
|---|---|---|
| Song | User **atau** System | Banyak per User, punya BPM dasar. Song milik System (**Song Template System**) bersifat read-only, dapat diakses Guest maupun User untuk Launcher Mode & Sequencer Mode (lihat-saja) |
| Section | Song | Dinamis (jumlah & nama bebas), punya urutan, **BPM override opsional** (nullable — ikut BPM dasar Song jika kosong) |
| SectionPart | Section | Tetap 5 per Section (satu per Part), `steps` nullable |
| **SoundSlot** *(baru)* | SectionPart | Dinamis (jumlah & label & key bebas per SectionPart), menggantikan slot tetap `sampleTak`/`sampleDung` |
| Sample | User **atau** System | Reusable, direferensikan oleh banyak SoundSlot (lintas SectionPart & Song). Sample milik System (**Sample Template System**) bersifat read-only bagi seluruh User, dapat dipakai bebas tanpa pembatasan |

---

## 9. Kriteria Penerimaan (Acceptance Criteria) — Level Fitur Utama

### AC-1: Membuat & Menyusun Section Dinamis
- **Given** User telah membuat Song
- **When** User menambah Section baru dengan nama bebas (mis. "Sahutan Variasi 2")
- **Then** Section tersimpan dengan 5 SectionPart kosong, dan User dapat menambah Section berikutnya tanpa batasan jumlah maupun nama yang telah ditentukan sebelumnya

### AC-2: Playback dengan Steps Panjang Berbeda per Section
- **Given** Section "Dasar" memiliki steps sepanjang 8 karakter, dan Section "Naik" memiliki steps sepanjang 24 karakter
- **When** User memutar kedua Section tersebut secara bergantian
- **Then** masing-masing Section melakukan loop sesuai panjang steps-nya sendiri tanpa error atau ketidaksesuaian

### AC-3: Reuse Sample Antar Section
- **Given** User telah mengunggah satu Sample "Rebana1-Tak-Keras.wav"
- **When** User memilih Sample tersebut untuk SectionPart di Section "Naik 1" dan juga di Section "Naik 2"
- **Then** kedua Section menggunakan file audio yang sama tanpa proses upload ulang, dan perubahan nama Sample (jika diedit) tercermin di kedua Section

### AC-4: Quantized Trigger Saat Berpindah Section
- **Given** Section "Dasar" sedang playback dan berada di tengah siklus (bukan di titik awal/akhir)
- **When** User menekan pad Section "Naik"
- **Then** Section "Dasar" tetap menyelesaikan siklus yang sedang berjalan hingga titik akhir, baru kemudian Section "Naik" mulai diputar — tidak terpotong di tengah siklus

### AC-5: Step Tanpa Sample Tidak Menghentikan Playback
- **Given** SoundSlot "Dung" pada SectionPart Part "bass" belum memiliki Sample terpasang (kosong)
- **When** Section tersebut diputar dan playhead melewati step yang merujuk ke SoundSlot "Dung" tsb
- **Then** playback berjalan normal untuk seluruh step/SectionPart lain, sementara step yang merujuk ke SoundSlot kosong tsb senyap tanpa memicu error

### AC-6: Penolakan Hapus Sample yang Masih Direferensikan
- **Given** Sample "Rebana1-Tak-Keras.wav" sedang direferensikan oleh minimal satu SoundSlot
- **When** User mencoba menghapus Sample tersebut
- **Then** sistem menolak permintaan penghapusan dan menampilkan pesan yang menjelaskan bahwa Sample masih digunakan; User dapat melihat/mengosongkan referensi terkait di SoundSlot tsb, dan setelah seluruh referensi dikosongkan, penghapusan Sample dapat berhasil dilakukan

### AC-7: SoundSlot Dinamis per SectionPart
- **Given** SectionPart Rebana 1 pada Section "Awalan" memiliki 2 SoundSlot (Tak, Dung), sementara SectionPart Rebana 1 pada Section "Naik" memiliki 3 SoundSlot (Tak, Dung, Duk)
- **When** User membuka Sequencer Mode untuk masing-masing Section tersebut
- **Then** editor step menampilkan jumlah baris/opsi bunyi sesuai SoundSlot yang terdaftar pada SectionPart yang sedang dibuka — tidak dipaksakan sama antar Section

### AC-8: Penolakan Hapus/Ubah Key SoundSlot yang Masih Dipakai di Steps
- **Given** SoundSlot berlabel "Duk" dengan key `K` pada suatu SectionPart, dan karakter `K` masih muncul di dalam `steps` SectionPart tsb
- **When** User mencoba menghapus SoundSlot "Duk" tersebut, atau mengubah key-nya menjadi karakter lain
- **Then** sistem menolak permintaan tersebut dan menampilkan pesan yang menjelaskan bahwa key masih dipakai di `steps`; User harus membersihkan/mengganti step yang memakai key tsb terlebih dahulu sebelum penghapusan atau perubahan key dapat berhasil

### AC-9: BPM Override per Section Diterapkan Saat Playback
- **Given** Song "Ya Habibal Qolbi" memiliki BPM dasar 90, Section "Dasar Lambat" memiliki BPM override 70, dan Section "Naik" tidak memiliki BPM override (kosong)
- **When** User memutar Section "Dasar Lambat" di Launcher Mode, lalu berpindah ke Section "Naik"
- **Then** Section "Dasar Lambat" diputar pada tempo 70 BPM; setelah quantized trigger berpindah ke Section "Naik", tempo langsung berubah seketika (hard cut) mengikuti BPM dasar Song (90), tanpa transisi bertahap

### AC-10: Section Baru Langsung Bisa Diputar Memakai Sample Template System
- **Given** User baru pertama kali membuat Song dan menambah Section "Awalan", tanpa mengunggah Sample apapun
- **When** User membuka Sequencer Mode atau Launcher Mode untuk Section tsb
- **Then** kelima SectionPart sudah memiliki SoundSlot default ("Tak"/"Dung") yang masing-masing sudah terpasang Sample Template System sesuai Part-nya; User dapat langsung mendengar preview atau memutar Section tsb tanpa upload apapun terlebih dahulu

### AC-11: Guest Dapat Memainkan Song Template System Tanpa Login
- **Given** pengunjung membuka aplikasi tanpa login (Guest)
- **When** Guest memilih salah satu Song Template System dan membuka Launcher Mode
- **Then** Guest dapat memicu pad Section dan mendengar playback secara penuh, tanpa diminta login; Guest juga dapat membuka Sequencer Mode Song tsb dan melihat susunan steps/SoundSlot, namun seluruh kontrol edit (input steps, tombol tambah SoundSlot, upload sample, dst) dalam keadaan nonaktif/read-only

### AC-12: Guest Ditolak Mengakses Song Milik User & Diarahkan untuk Login Saat Mencoba Edit
- **Given** Guest sedang melihat Sequencer Mode Song Template System
- **When** Guest mencoba mengklik kontrol edit (mis. toggle step, tombol "+ Tambah Bunyi")
- **Then** sistem menampilkan prompt "Login untuk edit" pada tempat yang sama, tanpa redirect paksa; Guest dapat mengabaikan prompt tsb dan tetap berada di halaman yang sama dalam mode lihat-saja. Terpisah dari itu, apabila Guest mencoba mengakses URL Song milik User manapun (bukan Song Template System) secara langsung, sistem menolak akses tsb (403/redirect ke daftar Song Template System)

---

## 10. Keputusan yang Telah Difinalisasi

Poin-poin berikut sebelumnya berstatus terbuka, dan telah difinalisasi melalui sesi klarifikasi lanjutan:

| # | Pertanyaan | Keputusan Final |
|---|---|---|
| 1 | Perilaku sistem saat Sample yang sedang direferensikan coba dihapus | **Tolak penghapusan** selama Sample masih direferensikan oleh SoundSlot manapun. User wajib mengosongkan seluruh referensi terlebih dahulu sebelum Sample dapat dihapus. *(→ FR-SAMP-08, FR-SAMP-10)* |
| 2 | Batas maksimum jumlah Section per Song, atau panjang maksimum `steps` | **Tidak ada batas praktis** — jumlah Section dan panjang steps bersifat dinamis tanpa batas atas yang ditetapkan pada level produk. *(→ FR-SEC-06, FR-SEQ-03)* |
| 3 | Format & ukuran file audio yang didukung untuk upload Sample | **Hanya format `.wav`**, ukuran maksimum **5MB per file** — dipilih demi konsistensi kualitas audio dibanding fleksibilitas format. *(→ FR-SAMP-06)* |
| 4 | Apakah preview audio saat edit steps termasuk MVP wajib | **Wajib (Must)** — dipindah dari Should menjadi Must di MVP. *(→ FR-SEQ-05)* |
| 5 | Apakah jenis bunyi pukulan terbatas pada 2 (Tak/Dung) tetap, atau bisa lebih variatif (mis. "Duk") sesuai kenyataan di lapangan | **Dinamis, didefinisikan per SectionPart** — jumlah dan nama jenis bunyi (SoundSlot) bebas ditentukan User, boleh berbeda antar Part maupun antar Section untuk Part yang sama; bukan lagi enum tetap `T`/`D`. *(→ Modul SoundSlot, Bagian 6.3; menggantikan pasangan kolom `sampleTakId`/`sampleDungId` pada rancangan sebelumnya)* |
| 6 | Siapa yang menentukan karakter (`key`) tiap SoundSlot dalam rumus `steps` | **User memilih sendiri** 1 karakter untuk tiap SoundSlot saat membuatnya, bukan digenerate otomatis sistem. *(→ FR-SLOT-01)* |
| 7 | Penanganan saat SoundSlot yang masih dipakai di `steps` dihapus atau key-nya diubah | **Tolak** penghapusan SoundSlot dan tolak perubahan `key` selama key tersebut masih dipakai di `steps` SectionPart terkait — konsisten dengan pola penanganan Sample (FR-SAMP-08). User wajib membersihkan/mengganti step yang memakai key tsb terlebih dahulu. *(→ FR-SLOT-06, TDD Bagian 6.5)* |
| 8 | Apakah tempo (BPM) tetap sama sepanjang Song, atau bisa berbeda tiap Section | **Bisa berbeda** — di lapangan, tempo Al-Banjari bisa sama atau beda tiap Section tergantung aransemen (bukan aturan tetap). Diimplementasikan sebagai **BPM override opsional per Section**: jika diisi, Section memakai BPM tsb; jika kosong, Section mengikuti BPM dasar Song. *(→ FR-SEC-08, FR-SEC-09, FR-PLAY-03)* |
| 9 | Bagaimana transisi tempo saat quantized trigger berpindah ke Section dengan BPM berbeda | **Hard cut (seketika)** — tempo langsung berubah tepat saat Section baru mulai, bukan transisi bertahap/ramp. Dipilih karena lebih sederhana secara implementasi dan konsisten dengan sifat quantized trigger yang sudah "memotong" di titik siklus yang tepat. *(→ FR-PLAY-11)* |
| 10 | Apakah perlu Sample bawaan (template) dari platform, mengingat ketersediaan sample real dari pemilik produk | **Ya** — direalisasikan sebagai **Sample Template System**: milik System (bukan User manapun), **read-only**, dapat dipakai/direferensikan oleh seluruh User tanpa pembatasan, dan mencakup audio lengkap untuk kelima Part (minimal Tak+Dung tiap Part). *(→ FR-SAMP-11–14)* |
| 11 | Bagaimana Sample Template System dipakai — wajib atau opsional? | **Auto-terisi sebagai default**, bukan wajib maupun sekadar opsi pasif di daftar: SoundSlot default yang otomatis dibuat saat SectionPart baru (FR-SLOT-09) langsung terpasang Sample Template System yang sesuai. User tetap bebas mengganti, memilih Sample lain, atau mengosongkannya kapan saja. *(→ FR-SLOT-09, FR-SAMP-11–14)* |
| 12 | Apakah Sample Template System dibatasi untuk grup/organisasi tertentu | **Tidak** — sama dan tersedia untuk seluruh User tanpa pembatasan akses maupun koneksi internal. *(→ FR-SAMP-13)* |
| 13 | Apakah user harus login sejak awal, atau bisa mencoba produk (khususnya Launcher Mode) tanpa login lebih dulu | **Bisa mencoba tanpa login (Guest)**, tapi terbatas pada **Song Template System** — Song bawaan platform yang sudah tersusun Section standar Al-Banjari lengkap dengan steps & Sample. Direalisasikan sebagai pola serupa Sample Template System: `is_system_template` pada Song, read-only, dikelola lewat seeding. *(→ FR-SONG-07–10, FR-AUTH-04)* |
| 14 | Apakah Guest bisa mengakses SEMUA Song (termasuk milik User lain), atau hanya Song Template System | **Hanya Song Template System** — Guest tidak dapat mengakses Song milik User manapun, baik di Launcher Mode maupun Sequencer Mode. *(→ FR-AUTH-05)* |
| 15 | Apakah Guest boleh melihat (bukan mengedit) Sequencer Mode | **Ya, boleh lihat (read-only)** — khusus untuk Song Template System. Guest dapat melihat susunan steps & SoundSlot, namun seluruh kontrol edit dinonaktifkan. *(→ FR-AUTH-04, FR-AUTH-06)* |
| 16 | Perilaku sistem saat Guest mencoba melakukan aksi yang butuh login | **Tetap di halaman yang sama**, menampilkan prompt "Login untuk edit" — bukan redirect paksa ke halaman lain. Guest dapat mengabaikan prompt dan melanjutkan menjelajah dalam mode terbatas. *(→ FR-AUTH-07)* |

### Pertanyaan yang Masih Terbuka

| # | Pertanyaan | Opsi yang Perlu Dipertimbangkan |
|---|---|---|
| 17 | Strategi penyimpanan file sample audio (lokal server vs. object storage/cloud) | Berdampak pada NFR-06 dan biaya infrastruktur — perlu dibahas pada Technical Design Document, karena sifatnya teknis-implementasi, bukan keputusan produk |

> Poin #17 sengaja tidak dikunci di level PRD karena merupakan keputusan arsitektur teknis (bukan requirement produk) — akan diselesaikan pada tahap **Technical Design Document (TDD)** berikutnya.

---

## 11. Metrik Produk (Product Metrics) — Usulan Awal

Karena produk belum memiliki basis pengguna, metrik berikut adalah usulan untuk mulai diukur sejak peluncuran awal, sebagai dasar evaluasi sebelum menetapkan target angka:

- Jumlah Song dibuat per User aktif
- Rata-rata jumlah Section per Song (indikator kompleksitas penggunaan)
- Rasio SectionPart yang memiliki sample terisi vs. kosong (indikator kelengkapan konten)
- Frekuensi penggunaan mode Launcher (playback) per Song
- Jumlah Sample diunggah per User, dan rasio reuse (dipakai di >1 SectionPart)

---

## 12. Referensi Fitur Fase Berikutnya (Di Luar Cakupan PRD Ini)

Untuk konteks arah produk jangka panjang, berikut cakupan fase berikutnya yang **tidak dirinci** pada PRD ini (akan menjadi PRD terpisah):

- **Fase 2:** Breakdown otomatis pola pukulan dari file audio eksternal (YouTube/MP3)
- **Fase 3:** Platform sharing pattern/variasi antar pengguna dan grup
- **Fase 4:** Dukungan part vokal & backing vokal, termasuk harmonisasi pecah suara
- **Fase 5:** Generate karya Al-Banjari lengkap (rebana + vokal) secara instan oleh satu individu
- **Fase 6:** Mode operasional untuk penggunaan langsung di acara/hajatan

Detail naratif tiap fase tersedia pada Dokumen Konsep, Bagian 12 (Roadmap Fitur Produk).

---

## 13. Referensi

- BRD: `BRD-bandjari.md`
- TDD (Technical Design Document): `TDD-bandjari.md`
- Dokumen Konsep (riset, domain knowledge, skema data ilustratif, tech stack): `bandjari-konsep.md`
- Kytaime Throwdown (referensi teknis playback): [github.com/haszari/kytaime](https://github.com/haszari/kytaime)
- GOTS Monorepo Starter Kit (referensi tech stack): [github.com/anasMuf/monorepo_gots_starterkit](https://github.com/anasMuf/monorepo_gots_starterkit)
