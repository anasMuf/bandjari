package service

import (
	"api/model"
	"testing"
)

func newOAuthTest(t *testing.T) (*fakeTokenUserRepo, OAuthService) {
	t.Helper()
	users := &fakeTokenUserRepo{users: map[uint]*model.User{
		1: {
			BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
			Name:      "Anas Lama",
			Email:     "a@mail.com",
			Role:      string(model.RoleUser),
		},
	}}
	return users, NewOAuthService(users)
}

func TestLoginOrCreateUser_ExistingEmailLinkedAndVerified(t *testing.T) {
	users, svc := newOAuthTest(t)

	user, err := svc.LoginOrCreateUser(GoogleUserInfo{
		Email: "a@mail.com", Name: "Anas Google", EmailVerified: true,
	})
	if err != nil {
		t.Fatalf("LoginOrCreateUser() error = %v", err)
	}
	if user.ID != 1 {
		t.Fatalf("harus memakai akun existing (id 1), got %d", user.ID)
	}
	if user.EmailVerifiedAt == nil {
		t.Fatal("email_verified_at harus terisi (Google confirmed)")
	}
	// Nama & role existing tidak boleh ditimpa.
	stored := users.users[1]
	if stored.Name != "Anas Lama" {
		t.Fatalf("nama akun existing berubah: %q", stored.Name)
	}
	if stored.Role != string(model.RoleUser) {
		t.Fatalf("role berubah: %q", stored.Role)
	}
}

func TestLoginOrCreateUser_NewEmailCreatesAccount(t *testing.T) {
	users, svc := newOAuthTest(t)

	user, err := svc.LoginOrCreateUser(GoogleUserInfo{
		Email: "baru@mail.com", Name: "User Baru", EmailVerified: true,
	})
	if err != nil {
		t.Fatalf("LoginOrCreateUser() error = %v", err)
	}
	if user.Email != "baru@mail.com" || user.Name != "User Baru" {
		t.Fatalf("user baru tidak sesuai: %+v", user)
	}
	if user.PasswordHash != "" {
		t.Fatal("akun Google tidak boleh punya password (login password tidak mungkin)")
	}
	if user.Role != string(model.RoleUser) {
		t.Fatalf("role = %q, want user", user.Role)
	}
	if user.EmailVerifiedAt == nil {
		t.Fatal("akun baru dari Google harus verified")
	}
	if _, ok := users.users[user.ID]; !ok {
		t.Fatal("user baru harus tersimpan di repo")
	}
}

func TestLoginOrCreateUser_NewEmailUnverifiedByGoogle(t *testing.T) {
	_, svc := newOAuthTest(t)

	user, err := svc.LoginOrCreateUser(GoogleUserInfo{
		Email: "ragu@mail.com", Name: "Ragu", EmailVerified: false,
	})
	if err != nil {
		t.Fatalf("LoginOrCreateUser() error = %v", err)
	}
	if user.EmailVerifiedAt != nil {
		t.Fatal("tanpa konfirmasi Google, akun harus tetap unverified")
	}
}

func TestLoginOrCreateUser_ExistingUnverifiedStaysUnverified(t *testing.T) {
	users, svc := newOAuthTest(t)
	users.users[1].EmailVerifiedAt = nil

	if _, err := svc.LoginOrCreateUser(GoogleUserInfo{
		Email: "a@mail.com", Name: "X", EmailVerified: false,
	}); err != nil {
		t.Fatalf("error = %v", err)
	}
	if users.users[1].EmailVerifiedAt != nil {
		t.Fatal("verified tidak boleh diisi bila Google tidak mengonfirmasi")
	}
}
