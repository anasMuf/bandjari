package model

import "gorm.io/datatypes"

// AuditLog mencatat jejak aksi keamanan (E-AUTH-2026 R13).
// UserID nil untuk aksi anonim (mis. percobaan login gagal sebelum identitas
// user dipastikan). Detail menyimpan konteks tambahan sebagai JSONB.
type AuditLog struct {
	BaseModel
	UserID    *uint          `json:"user_id,omitempty" gorm:"index"`
	Action    string         `json:"action" gorm:"type:varchar(64);not null;index"`
	Detail    datatypes.JSON `json:"detail,omitempty" gorm:"type:jsonb"`
	IP        string         `json:"ip,omitempty" gorm:"type:varchar(45)"`
	UserAgent string         `json:"user_agent,omitempty" gorm:"type:varchar(255)"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
