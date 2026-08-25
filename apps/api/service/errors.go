package service

import "errors"

// Sentinel error bersama untuk seluruh modul domain — dipetakan handler
// ke status HTTP sesuai TDD Bagian 6.7.
var (
	ErrNotFound   = errors.New("resource tidak ditemukan")
	ErrForbidden  = errors.New("akses ditolak")
	ErrConflict   = errors.New("konflik data")
	ErrBadRequest = errors.New("input tidak valid")
	// --- Refresh token (E-AUTH-2026 R2) ---
	ErrInvalidRefreshToken = errors.New("refresh token tidak valid")
	ErrRefreshTokenRevoked = errors.New("refresh token sudah dicabut")
	ErrRefreshTokenExpired = errors.New("refresh token kedaluwarsa")
	ErrRefreshTokenReuse   = errors.New("refresh token dipakai ulang setelah rotasi — sesi dicabut")
	// --- Email verification (E-AUTH-2026 R9) ---
	ErrInvalidVerificationCode = errors.New("kode verifikasi tidak valid atau kedaluwarsa")
	// --- Password reset (E-AUTH-2026 R10) ---
	ErrInvalidResetToken = errors.New("kode reset tidak valid atau kedaluwarsa")
	// ErrAccountLocked — akun sedang dikunci (lockout). Sentinel INTERNAL untuk
	// audit — handler tetap mengembalikan 401 seragam (anti-enumeration).
	ErrAccountLocked = errors.New("akun terkunci sementara")
	// ErrSocialLoginRequired — akun dibuat via Google (tanpa password). Login
	// password TIDAK mungkin; UX menuntun ke "Masuk dengan Google".
	ErrSocialLoginRequired = errors.New("akun ini menggunakan login Google")
	// ErrSocialLinkRequired — akun punya password tapi belum terhubung ke
	// provider. Login Google DITOLAK (V1-A); UX menuntun ke link eksplisit
	// dari pengaturan.
	ErrSocialLinkRequired = errors.New("hubungkan Google dari pengaturan akun")
	// ErrProviderTaken — provider subject sudah terhubung ke akun lain.
	ErrProviderTaken = errors.New("akun provider ini sudah terhubung ke akun lain")
	// ErrLastLoginMethod — unlink ditolak karena ini satu-satunya metode login
	// (tanpa password & tanpa provider lain).
	ErrLastLoginMethod = errors.New("tidak bisa memutuskan satu-satunya metode login — set password dulu")
	// ErrNoPassword — akun tanpa password (Google-only) mencoba change-password.
	// Arahkan ke set-password.
	ErrNoPassword = errors.New("akun belum punya password — gunakan set password")
	// ErrPasswordAlreadySet — akun sudah punya password mencoba set-password.
	// Arahkan ke change-password.
	ErrPasswordAlreadySet = errors.New("akun sudah punya password — gunakan ganti password")
)
