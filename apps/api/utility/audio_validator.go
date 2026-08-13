package utility

import (
	"errors"

	"github.com/gabriel-vasile/mimetype"
)

// MaxSampleSizeBytes — batas ukuran file audio sample (FR-SAMP-06): 5MB.
const MaxSampleSizeBytes = 5 * 1024 * 1024

var (
	ErrFileTooLarge      = errors.New("ukuran file melebihi batas 5MB")
	ErrUnsupportedFormat = errors.New("format file harus .wav")
)

// ValidateWavAudio memvalidasi ukuran & format file audio (magic bytes,
// bukan hanya ekstensi — FR-SAMP-06).
func ValidateWavAudio(data []byte) error {
	if len(data) > MaxSampleSizeBytes {
		return ErrFileTooLarge
	}
	mime := mimetype.Detect(data)
	if mime.String() != "audio/wav" && mime.String() != "audio/x-wav" {
		return ErrUnsupportedFormat
	}
	return nil
}
