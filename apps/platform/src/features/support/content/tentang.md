## Tentang BandJari

**BandJari** adalah aplikasi web untuk menyusun dan memainkan pola pukulan rebana Al-Banjari — seni musik tradisional yang dimainkan dengan 4 rebana + 1 bass. Nama "BandJari" lahir dari semangatnya: *bermain musik selayaknya sebuah band, cukup dengan jari*.

Aplikasi ini dibuat untuk mempermudah grup hadrah/banjari menyusun pola pukulan, berlatih, dan tampil — cukup dengan perangkat yang ada, tanpa perangkat lunak berat.

## Fitur Utama

- **Penyusun pola (Sequencer)** — grid step dengan multi-bunyi per kolom, mute per part, dan preview real-time.
- **Pemutar live (Launcher)** — mainkan pola seperti bermain instrument: pad dinamis, kontrol BPM realtime, dan antrian section.
- **Manajemen lagu & section** — komposisi fleksibel: section bebas nama, perilaku diulang/sekali, tujuan lanjut, dan BPM override.
- **Library sample** — unggah sample `.wav` milik sendiri dan atur jenis bunyi per instrumen.
- **Template sistem** — lagu & sample bawaan siap main, bisa diduplikasi untuk diedit.

## Teknologi

Dibangun dengan standar web modern: React + TypeScript, Vite, TanStack Router & Query, Tailwind CSS, dan backend Go (Echo + PostgreSQL) — seluruh audio diproses dan dijadwalkan **100% di sisi klien** (Web Worker + Web Audio API).

## Kredit & Atribusi

BandJari berdiri berkat karya pihak-pihak berikut — terima kasih banyak 🙏:

- **Sumber audio sample** — sample template sistem diambil dari **SAMPLING HADRAH AB CHANNEL** ([tautan](https://youtu.be/uPCOB0gckVw?si=GhlahL2dOFoiHI4K)).
- **Desain logo & aset** — logo BandJari dirancang oleh **Anas Mufti**.
- **Teknologi open source** — dibangun di atas ekosistem open source: React, TanStack, Vite, Tailwind CSS, Go, Echo, PostgreSQL, dan lainnya.

## Pengembang & Kontribusi

BandJari dikembangkan oleh **Anas Mufti** sebagai proyek terbuka, berfokus pada kebutuhan
komunitas banjari/hadrah Indonesia. Kode sumber tersedia di
[GitHub — anasMuf/bandjari](https://github.com/anasMuf/bandjari) dengan lisensi ISC.

Kontribusi dari siapa pun sangat diterima:

- **Lapor bug / usul fitur** — buka issue di repositori GitHub.
- **Kirim perbaikan** — pull request dipersilakan.
- **Diskusi & masukan** — sampaikan via GitHub atau halaman [Kontak](/kontak).

Dukung kelanjutan pengembangan di halaman [Donasi](/donasi) — setiap dukungan berarti untuk biaya server, storage audio, dan fitur baru. 🙏

## Hubungi Kami

Punya pertanyaan, saran, atau menemukan kendala? Silakan lihat [FAQ](/faq) dan [Bantuan](/bantuan), atau sampaikan langsung melalui halaman [Kontak](/kontak).
