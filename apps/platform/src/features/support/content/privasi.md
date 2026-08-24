# Kebijakan Privasi BandJari

*Terakhir diperbarui: 24 Agustus 2026*

## 1. Data yang Kami Kumpulkan

- **Akun**: saat mendaftar, kami menyimpan nama, alamat email, dan kata sandi (dalam bentuk ter-hash). Role akun (user/admin) disimpan untuk pengaturan akses.
- **Masuk dengan Google (opsional)**: bila Anda memilih masuk dengan Google, kami menerima nama, alamat email, dan konfirmasi kepemilikan email dari Google, sesuai izin yang Anda berikan saat login.
- **Karya Anda**: lagu, section, pola pukulan, dan sample audio yang Anda buat/unggah tersimpan di server agar bisa diakses dari perangkat mana pun.
- **Data teknis & audit**: server mencatat log dasar (alamat IP, user-agent, waktu akses) dan riwayat aksi keamanan (mis. login, verifikasi email, reset kata sandi) untuk keamanan dan pemantauan.

## 2. Penggunaan Data

Data dipakai untuk: menjalankan layanan (menyimpan & memuat karya Anda), autentikasi, mengirim email transaksional (verifikasi alamat email & reset kata sandi), keamanan layanan, dan perbaikan produk. Kami **tidak menjual** data pribadi Anda kepada pihak mana pun.

## 3. Penyimpanan & Keamanan

- Kata sandi disimpan dengan hashing satu arah; tidak pernah disimpan sebagai teks biasa.
- Alamat email dapat diminta verifikasi untuk mengonfirmasi kepemilikan Anda.
- Kami menerapkan pembatasan upaya login berulang (account lockout) untuk melindungi akun dari percobaan tebak kata sandi.
- Akses ke data pribadi dibatasi; hanya pengguna pemilik dan admin sistem (untuk dukungan/keamanan) yang dapat mengaksesnya.
- Sample audio disimpan di object storage (S3-compatible) dengan akses terkontrol.

## 4. Cookie & Sesi

- Kami menggunakan **cookie httpOnly** untuk menyimpan token penyegar (refresh token) sesi masuk, dan **token akses jangka pendek disimpan di memori browser** (tidak di penyimpanan lokal). Cookie ini tidak berisi data sensitif dan dibersihkan saat logout.
- Kami mengirim **email transaksional** (verifikasi alamat email, reset kata sandi) ke alamat yang Anda daftarkan.

## 5. Berbagi Data ke Pihak Ketiga

Kami tidak membagikan data pribadi ke pihak ketiga, kecuali: (a) demi hukum, (b) melindungi hak & keamanan layanan, (c) dengan persetujuan Anda, (d) **penyedia layanan email (SMTP)** — alamat email Anda diproses semata-mata untuk mengirim email verifikasi/reset, atau (e) **Google** — hanya saat Anda memilih masuk dengan Google.

## 6. Hak Anda

Anda dapat: mengakses dan memperbarui data akun melalui halaman Profile, menghapus karya sendiri kapan saja, serta meminta penghapusan akun dengan menghubungi kami via halaman [Kontak](/kontak).

## 7. Perubahan Kebijakan

Kebijakan ini dapat diperbarui sewaktu-waktu. Perubahan signifikan akan diumumkan di halaman ini.

## 8. Kontak

Pertanyaan terkait privasi: hubungi kami melalui halaman [Kontak](/kontak).
