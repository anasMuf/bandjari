package service

import (
	"api/model"
	"api/repository"
	"encoding/json"
)

// Konstanta aksi audit (E-AUTH-2026 R13).
const (
	ActionRegister       = "register"
	ActionLoginSuccess   = "login_success"
	ActionLoginFailed    = "login_failed"
	ActionLoginLocked    = "login_locked"
	ActionLogout         = "logout"
	ActionRefresh        = "refresh"
	ActionVerifyEmail    = "verify_email"
	ActionForgotPassword = "forgot_password"
	ActionResetPassword  = "reset_password"
	ActionGoogleLogin    = "google_login"
	ActionRoleChange     = "role_change"
	// --- E-PROFILE-2026: pengelolaan akun ---
	ActionProviderLink   = "provider_link"
	ActionProviderUnlink = "provider_unlink"
	ActionProfileUpdate  = "profile_update"
	ActionPasswordChange = "password_change"
	ActionSessionRevoke  = "session_revoke"
	ActionAccountDelete  = "account_delete"
)

// AuditService — pencatatan jejak keamanan. Best-effort: caller BOLEH
// mengabaikan error — audit tidak boleh menggagalkan operasi utama.
type AuditService interface {
	// Record menulis satu baris audit. userID nil untuk aksi anonim
	// (mis. login gagal dengan email tidak dikenal, logout via cookie).
	Record(userID *uint, action string, detail map[string]any, ip, userAgent string) error
}

type auditService struct {
	repo repository.AuditLogRepository
}

func NewAuditService(repo repository.AuditLogRepository) AuditService {
	return &auditService{repo: repo}
}

func (s *auditService) Record(userID *uint, action string, detail map[string]any, ip, userAgent string) error {
	log := &model.AuditLog{
		UserID:    userID,
		Action:    action,
		IP:        ip,
		UserAgent: userAgent,
	}
	if len(detail) > 0 {
		raw, err := json.Marshal(detail)
		if err != nil {
			return err
		}
		log.Detail = raw
	}
	return s.repo.Create(log)
}
