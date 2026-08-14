package service

import "api/model"

// canMutateSong menentukan apakah user boleh memutasi sebuah Song:
//   - Song Template System → hanya admin.
//   - Song milik User → hanya pemiliknya (admin TIDAK otomatis berhak atas
//     data pribadi user lain — aturan kepemilikan tetap berlaku, FR-AUTH-02).
func canMutateSong(song *model.Song, userID uint, isAdmin bool) bool {
	if song.IsSystemTemplate {
		return isAdmin
	}
	return song.UserID != nil && *song.UserID == userID
}

// canMutateSample — aturan yang sama untuk Sample:
// Sample Template System hanya admin; sample milik user hanya pemiliknya.
func canMutateSample(sample *model.Sample, userID uint, isAdmin bool) bool {
	if sample.IsSystemTemplate {
		return isAdmin
	}
	return sample.UserID != nil && *sample.UserID == userID
}
