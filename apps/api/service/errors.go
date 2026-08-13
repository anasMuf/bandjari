package service

import "errors"

// Sentinel error bersama untuk seluruh modul domain — dipetakan handler
// ke status HTTP sesuai TDD Bagian 6.7.
var (
	ErrNotFound   = errors.New("resource tidak ditemukan")
	ErrForbidden  = errors.New("akses ditolak")
	ErrConflict   = errors.New("konflik data")
	ErrBadRequest = errors.New("input tidak valid")
)
