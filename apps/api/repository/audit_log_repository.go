package repository

import (
	"api/model"

	"gorm.io/gorm"
)

// AuditLogRepository — penyimpanan jejak keamanan (E-AUTH-2026 R13).
type AuditLogRepository interface {
	Create(log *model.AuditLog) error
}

type auditLogRepository struct {
	db *gorm.DB
}

func NewAuditLogRepository(db *gorm.DB) AuditLogRepository {
	return &auditLogRepository{db: db}
}

func (r *auditLogRepository) Create(log *model.AuditLog) error {
	return r.db.Create(log).Error
}
