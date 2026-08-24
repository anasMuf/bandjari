package service

import (
	"api/model"
	"testing"
)

type fakeAuditRepo struct {
	logs []*model.AuditLog
}

func (f *fakeAuditRepo) Create(log *model.AuditLog) error {
	f.logs = append(f.logs, log)
	return nil
}

func TestAuditService_Record(t *testing.T) {
	repo := &fakeAuditRepo{}
	svc := NewAuditService(repo)
	id := uint(7)

	if err := svc.Record(&id, ActionLoginSuccess, map[string]any{"email": "a@mail.com"}, "1.2.3.4", "Mozilla"); err != nil {
		t.Fatalf("Record() error = %v", err)
	}
	if len(repo.logs) != 1 {
		t.Fatalf("logs = %d, want 1", len(repo.logs))
	}
	log := repo.logs[0]
	if log.Action != ActionLoginSuccess {
		t.Fatalf("action = %q", log.Action)
	}
	if log.UserID == nil || *log.UserID != 7 {
		t.Fatalf("user_id = %v, want 7", log.UserID)
	}
	if log.IP != "1.2.3.4" || log.UserAgent != "Mozilla" {
		t.Fatalf("ip/ua = %q/%q", log.IP, log.UserAgent)
	}
	if string(log.Detail) != `{"email":"a@mail.com"}` {
		t.Fatalf("detail = %s", log.Detail)
	}
}

func TestAuditService_RecordAnonymous(t *testing.T) {
	repo := &fakeAuditRepo{}
	svc := NewAuditService(repo)

	if err := svc.Record(nil, ActionLoginFailed, nil, "1.2.3.4", ""); err != nil {
		t.Fatalf("Record() error = %v", err)
	}
	log := repo.logs[0]
	if log.UserID != nil {
		t.Fatalf("user_id harus nil untuk aksi anonim, got %v", log.UserID)
	}
	if log.Detail != nil {
		t.Fatalf("detail harus nil bila kosong, got %s", log.Detail)
	}
}
