package service

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// isUniqueViolation mendeteksi pelanggaran unique constraint PostgreSQL
// (SQLSTATE 23505) — dipakai untuk membedakan race key SoundSlot (→ 400)
// dari kegagalan DB sungguhan (→ 500).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
