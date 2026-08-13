# Business Requirements Document (BRD)
## BandJari

| | |
|---|---|
| **Dokumen** | Business Requirements Document (BRD) |
| **Produk** | BandJari |
| **Versi** | 1.0 |
| **Status** | Draft |
| **Dokumen Terkait** | [Dokumen Konsep](./bandjari-konsep.md) · [PRD](./PRD-bandjari.md) |

> *"BandJari" — bermain musik selayaknya sebuah band, cukup dengan jari.*

---

## 1. Ringkasan Eksekutif

BandJari adalah aplikasi web yang menyediakan pola pukulan rebana Al-Banjari secara digital, memungkinkan individu maupun grup untuk berlatih, tampil, dan berbagi karya tanpa terikat ketersediaan personil pemain rebana secara fisik.

Kesenian Al-Banjari secara tradisional membutuhkan satu regu lengkap (±10 personil: 5 pemain rebana + 5 vokal/backing vokal) untuk bisa dimainkan. Produk ini menjawab kesenjangan antara **minat/bakat individu** (khususnya vokalis) dengan **keterbatasan ketersediaan rekan bermain**, sekaligus membuka peluang pembelajaran dan kolaborasi komunitas yang lebih luas secara digital.

---

## 2. Latar Belakang Bisnis

Rebana Al-Banjari adalah kesenian religi Islami yang berkembang pesat di Jawa Timur dan sekitarnya, didukung oleh ekosistem kompetisi aktif seperti **Fesban (Festival Al-Banjari)**. Minat masyarakat — khususnya generasi muda — terhadap kesenian ini tetap tinggi, terlihat dari maraknya grup-grup Al-Banjari di tingkat RT/RW, remaja masjid, hingga majelis taklim.

Namun, sifat kesenian ini yang **berbasis regu/kelompok** menciptakan hambatan struktural: seseorang dengan bakat vokal tidak serta-merta bisa berkarya jika tidak memiliki akses ke rekan pemain rebana yang lengkap. Hambatan ini bersifat sosial (jaringan pertemanan terbatas) maupun logistik (koordinasi waktu latihan bersama 10 orang).

Di sisi lain, belum ada produk digital yang secara spesifik melayani kebutuhan niche ini — berbeda dari aplikasi drum pad atau beat maker generik yang tidak merepresentasikan karakteristik pukulan Al-Banjari yang khas.

---

## 3. Rumusan Masalah Bisnis

| # | Masalah | Dampak |
|---|---|---|
| BP-1 | Individu (khususnya vokalis) memiliki minat/bakat Al-Banjari tapi tidak punya rekan pemain rebana yang lengkap | Bakat tidak tersalurkan; potensi partisipasi dalam kesenian ini hilang |
| BP-2 | Grup yang kekurangan personil rebana pada hari acara (hajatan, maulid, dsb) tidak punya solusi cepat | Kualitas acara terganggu, atau acara batal menampilkan Al-Banjari |
| BP-3 | Proses mempelajari variasi pukulan dari lagu referensi (YouTube/MP3) masih manual (ear training) | Proses belajar lambat, tidak semua orang punya kemampuan ear training yang cukup, variasi sulit diwariskan secara presisi |
| BP-4 | Tidak ada wadah digital untuk berbagi pattern/variasi antar grup Al-Banjari | Kreativitas satu grup terisolasi, tidak menyebar ke komunitas lebih luas; pelestarian variasi lokal berisiko hilang |

---

## 4. Tujuan Bisnis

1. Menyediakan solusi yang memungkinkan individu tanpa regu lengkap tetap bisa berlatih dan berkarya dalam kesenian Al-Banjari
2. Mempercepat dan mempermudah proses regenerasi/pewarisan variasi pukulan antar generasi maupun antar grup
3. Membangun basis komunitas digital Al-Banjari sebagai wadah kolaborasi dan pelestarian budaya
4. Menjadi solusi praktis pendukung kebutuhan operasional grup Al-Banjari di lapangan (saat acara berlangsung)

---

## 5. Sasaran Pengguna (Target Audience)

| Segmen | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Vokalis mandiri** | Individu berbakat vokal Al-Banjari, tidak tergabung/tidak punya akses ke regu rebana lengkap | Iringan rebana virtual untuk latihan/tampil mandiri |
| **Grup/Regu Al-Banjari** | Kelompok terorganisir (remaja masjid, majelis taklim, dsb) yang aktif tampil maupun mengikuti Fesban | Alat bantu menyusun & melatih variasi pukulan grup sendiri |
| **Pembelajar/pemula** | Orang yang baru belajar Al-Banjari, ingin memahami pola pukulan dari lagu-lagu yang sudah ada | Referensi pola pukulan yang mudah dipelajari dan divisualisasikan |
| **Panitia/pengurus acara** | Pihak yang menyelenggarakan hajatan/acara dan membutuhkan pengisi Al-Banjari | Solusi cepat saat personil rebana tidak lengkap pada hari-H |

---

## 6. Ruang Lingkup

### 6.1 Dalam Lingkup (In Scope) — Fase Awal

- Penyusunan pola pukulan digital untuk formasi Al-Banjari murni (4 rebana + 1 bass)
- Kemampuan memicu (trigger) pola secara live menyerupai clip launcher, bukan drum pad konvensional
- Pengelolaan banyak lagu per pengguna, dengan struktur bagian lagu (section) yang fleksibel — termasuk **tempo yang dapat berbeda antar bagian lagu**, mengikuti kebiasaan Al-Banjari yang lazim mempercepat/memperlambat tempo pada fase tertentu
- Penggunaan sample audio asli (rekaman pukulan rebana sungguhan) yang dapat digunakan ulang antar bagian lagu

### 6.2 Di Luar Lingkup (Out of Scope) — Fase Awal

Butir berikut adalah arah pengembangan yang **sudah diidentifikasi** sebagai bagian dari visi produk, namun **belum masuk fase pengembangan awal** karena kompleksitas teknis dan/atau belum melalui proses klarifikasi kebutuhan detail:

- Breakdown/analisis otomatis pola pukulan dari file audio eksternal (YouTube/MP3)
- Platform berbagi (sharing) pattern/variasi antar pengguna atau antar grup
- Dukungan part vokal & backing vokal, termasuk harmonisasi pecah suara dan deteksi pitch
- Kemampuan menghasilkan karya Al-Banjari lengkap (rebana + vokal) secara instan oleh satu individu
- Mode operasional khusus untuk penggunaan langsung di acara/hajatan (mis. integrasi sound system, mode tampil untuk operator non-teknis)

> Cakupan Out of Scope di atas akan dirinci lebih lanjut sebagai BRD/PRD tambahan pada fase pengembangan berikutnya, sesuai kesiapan riset teknis masing-masing area (khususnya audio processing dan analisis pitch/vokal).

---

## 7. Kriteria Keberhasilan (Success Criteria)

Kriteria berikut bersifat kualitatif pada tahap awal (belum ada baseline data pengguna); akan disempurnakan menjadi metrik terukur (KPI) setelah produk memiliki basis pengguna awal.

| Area | Indikator Keberhasilan |
|---|---|
| Adopsi individu | Vokalis tanpa regu lengkap dapat menyusun dan memainkan minimal satu lagu penuh secara mandiri |
| Akurasi representasi kesenian | Pola pukulan yang dihasilkan aplikasi dapat diterima/diakui merepresentasikan pukulan Al-Banjari yang otentik oleh pelaku kesenian — mencakup bukan hanya pola pukulannya, tetapi juga **dinamika tempo antar fase lagu** (mis. percepatan pada bagian "Naik", perlambatan menjelang penutup), yang merupakan bagian dari karakter musikal kesenian ini dan bukan sekadar pola pada tempo tetap |
| Fleksibilitas kreatif | Pengguna dapat menyusun variasi/aransemen bagian lagu (section) sesuai kreativitas masing-masing, tanpa batasan struktur yang kaku |
| Kesiapan fondasi jangka panjang | Arsitektur data & fitur fase awal mendukung perluasan ke breakdown audio, sharing komunitas, dan dukungan vokal tanpa perombakan besar |

---

## 8. Asumsi

- Pengguna awal familiar dengan istilah dan notasi dasar Al-Banjari (T/Tak, D/Dung, serta variasi bunyi lain yang lazim dipakai grup masing-masing seperti "Duk"), sehingga fase awal tidak memerlukan tutorial mendalam tentang teori dasar kesenian ini
- Ketersediaan sample audio rebana yang berkualitas bergantung pada kontribusi upload dari pengguna sendiri (bukan disediakan oleh platform di fase awal)
- Formasi instrumen (4 rebana + 1 bass) merepresentasikan mayoritas kebutuhan grup Al-Banjari "murni" tanpa alat pendukung tambahan (di luar cakupan varian dengan keprak/kaplak/dumbuk)

## 9. Batasan (Constraints)

- Fase awal produk fokus pada representasi instrumen rebana; elemen vokal belum tercakup, sehingga nilai produk pada fase ini terbatas pada aspek instrumental
- Teknologi breakdown audio otomatis (Out of Scope fase awal) memiliki tingkat kompleksitas teknis tinggi (audio source separation, onset detection) dan berisiko akurasi terbatas — perlu dikelola ekspektasinya sebagai fitur eksperimental saat direalisasikan

## 10. Risiko Bisnis

| Risiko | Dampak | Mitigasi Awal |
|---|---|---|
| Representasi pola pukulan dianggap tidak otentik/kurang tepat oleh komunitas Al-Banjari | Rendahnya kepercayaan & adopsi dari kalangan pelaku kesenian | Validasi model data pola pukulan dengan pelaku/komunitas Al-Banjari sejak fase awal |
| Ketergantungan pada kontribusi sample audio dari pengguna | Pengalaman pengguna baru terhambat jika belum ada sample tersedia | Menyediakan mekanisme sample default/starter di fase pengembangan berikutnya |
| Ekspektasi pengguna terhadap fitur breakdown audio otomatis (Out of Scope) melebihi kapabilitas teknis yang realistis | Kekecewaan pengguna, ekspektasi tidak terpenuhi | Komunikasi roadmap yang jelas mengenai status tiap fitur (tersedia vs. rencana) |

---

## 11. Referensi

- Dokumen Konsep (riset & eksplorasi awal): `bandjari-konsep.md`
- PRD terkait: `PRD-bandjari.md`
