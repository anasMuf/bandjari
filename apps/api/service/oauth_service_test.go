package service

import (
	"api/model"
	"errors"
	"testing"

	"gorm.io/gorm"
)

// fakeProviderRepo — implementasi repository.UserProviderRepository di memory.
type fakeProviderRepo struct {
	links  map[string]*model.UserProvider // key: "provider:subject"
	nextID uint
}

func newFakeProviderRepo() *fakeProviderRepo {
	return &fakeProviderRepo{links: map[string]*model.UserProvider{}, nextID: 1}
}

func (f *fakeProviderRepo) key(provider, subject string) string { return provider + ":" + subject }

func (f *fakeProviderRepo) FindByProviderSubject(provider, subject string) (*model.UserProvider, error) {
	if l, ok := f.links[f.key(provider, subject)]; ok {
		return l, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeProviderRepo) FindByUserIDAndProvider(userID uint, provider string) (*model.UserProvider, error) {
	for _, l := range f.links {
		if l.UserID == userID && l.Provider == provider {
			return l, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeProviderRepo) ListByUserID(userID uint) ([]model.UserProvider, error) {
	var out []model.UserProvider
	for _, l := range f.links {
		if l.UserID == userID {
			out = append(out, *l)
		}
	}
	return out, nil
}

func (f *fakeProviderRepo) Create(l *model.UserProvider) error {
	key := f.key(l.Provider, l.ProviderSubject)
	if _, ok := f.links[key]; ok {
		return errors.New("duplicate provider link")
	}
	l.ID = f.nextID
	f.nextID++
	f.links[key] = l
	return nil
}

func (f *fakeProviderRepo) Delete(userID uint, provider string) error {
	for key, l := range f.links {
		if l.UserID == userID && l.Provider == provider {
			delete(f.links, key)
		}
	}
	return nil
}

func (f *fakeProviderRepo) DeleteAllByUserID(userID uint) error {
	for key, l := range f.links {
		if l.UserID == userID {
			delete(f.links, key)
		}
	}
	return nil
}

// failingProviderRepo — DeleteAllByUserID selalu gagal (uji propagasi error).
type failingProviderRepo struct {
	*fakeProviderRepo
}

func (f *failingProviderRepo) DeleteAllByUserID(userID uint) error {
	return errors.New("cleanup provider gagal")
}

func newOAuthTest(t *testing.T) (*fakeTokenUserRepo, *fakeProviderRepo, OAuthService) {
	t.Helper()
	users := &fakeTokenUserRepo{users: map[uint]*model.User{
		1: {
			BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
			Name:      "Anas Lama",
			Email:     "a@mail.com",
			Role:      string(model.RoleUser),
		},
	}}
	providers := newFakeProviderRepo()
	return users, providers, NewOAuthService(users, providers)
}

func TestLoginOrCreateUser_ExistingEmailLinkedAndVerified(t *testing.T) {
	users, providers, svc := newOAuthTest(t)

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
	// Backfill provider row bila subject disertakan.
	if len(providers.links) != 0 {
		t.Fatalf("tanpa subject tidak boleh ada provider link, got %d", len(providers.links))
	}
}

func TestLoginOrCreateUser_NewEmailCreatesAccount(t *testing.T) {
	users, providers, svc := newOAuthTest(t)

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
	if len(providers.links) != 0 {
		t.Fatalf("tanpa subject tidak boleh ada provider link, got %d", len(providers.links))
	}
}

func TestLoginOrCreateUser_NewEmailUnverifiedByGoogle(t *testing.T) {
	_, _, svc := newOAuthTest(t)

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
	users, _, svc := newOAuthTest(t)
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

// --- E-PROFILE-2026 V1-A: match by provider_subject ---

func TestLoginOrCreateUser_MatchesByProviderSubject(t *testing.T) {
	_, providers, svc := newOAuthTest(t)
	// User 1 sudah terhubung ke subject google-123.
	providers.links["google:google-123"] = &model.UserProvider{
		BaseModel:       model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
		UserID:          1,
		Provider:        string(model.ProviderGoogle),
		ProviderSubject: "google-123",
	}

	// Email di info Google BEDA dari email akun — tetap match by subject.
	user, err := svc.LoginOrCreateUser(GoogleUserInfo{
		Email: "lain@mail.com", Name: "Siapa", EmailVerified: true, ProviderSubject: "google-123",
	})
	if err != nil {
		t.Fatalf("error = %v", err)
	}
	if user.ID != 1 {
		t.Fatalf("harus memakai akun terhubung (id 1), got %d", user.ID)
	}
}

func TestLoginOrCreateUser_AccountWithPassword_RejectedWithoutLink(t *testing.T) {
	users, _, svc := newOAuthTest(t)
	// User 1 punya password (akun password-only).
	users.users[1].PasswordHash = "hash-ada-password"

	_, err := svc.LoginOrCreateUser(GoogleUserInfo{
		Email: "a@mail.com", Name: "X", EmailVerified: true, ProviderSubject: "google-456",
	})
	if !errors.Is(err, ErrSocialLinkRequired) {
		t.Fatalf("error = %v, want ErrSocialLinkRequired", err)
	}
}

func TestLoginOrCreateUser_PasswordlessEmailMatch_BackfillsProvider(t *testing.T) {
	users, providers, svc := newOAuthTest(t)
	// User 1 tanpa password (akun Google legacy) + subject → backfill link.
	users.users[1].PasswordHash = ""

	user, err := svc.LoginOrCreateUser(GoogleUserInfo{
		Email: "a@mail.com", Name: "X", EmailVerified: true, ProviderSubject: "google-legacy-1",
	})
	if err != nil {
		t.Fatalf("error = %v", err)
	}
	if user.ID != 1 {
		t.Fatalf("harus memakai akun existing, got %d", user.ID)
	}
	link, err := providers.FindByProviderSubject(string(model.ProviderGoogle), "google-legacy-1")
	if err != nil || link == nil {
		t.Fatal("provider link harus dibuat (backfill) untuk akun legacy passwordless")
	}
	if link.UserID != 1 {
		t.Fatalf("link user_id = %d, want 1", link.UserID)
	}
}

func TestLoginOrCreateUser_NewAccount_CreatesProviderRow(t *testing.T) {
	_, providers, svc := newOAuthTest(t)

	user, err := svc.LoginOrCreateUser(GoogleUserInfo{
		Email: "baru@mail.com", Name: "Baru", EmailVerified: true, ProviderSubject: "google-new-1",
	})
	if err != nil {
		t.Fatalf("error = %v", err)
	}
	link, err := providers.FindByProviderSubject(string(model.ProviderGoogle), "google-new-1")
	if err != nil || link == nil {
		t.Fatal("akun baru dari Google harus punya provider row")
	}
	if link.UserID != user.ID {
		t.Fatalf("link user_id = %d, want %d", link.UserID, user.ID)
	}
}

func TestLinkProvider_Idempotent(t *testing.T) {
	_, providers, svc := newOAuthTest(t)

	if err := svc.LinkProvider(1, string(model.ProviderGoogle), "google-dup"); err != nil {
		t.Fatalf("link pertama error = %v", err)
	}
	if err := svc.LinkProvider(1, string(model.ProviderGoogle), "google-dup"); err != nil {
		t.Fatalf("link kedua (idempotent) error = %v", err)
	}
	count := 0
	for _, l := range providers.links {
		if l.UserID == 1 {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("link duplikat: count = %d, want 1", count)
	}
}

func TestLinkProvider_SubjectTakenByOtherUser(t *testing.T) {
	newOAuthTest(t) // fixtures tidak dipakai — dibangun ulang di bawah
	// User 1 (tanpa password) sudah terhubung ke subject — lalu user 2 mencoba
	// link subject yang sama.
	users := &fakeTokenUserRepo{users: map[uint]*model.User{
		2: {
			BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 2}},
			Name:      "Orang Lain",
			Email:     "lain@mail.com",
			Role:      string(model.RoleUser),
			// Punya password supaya guard unlink tidak mengganggu path ini.
			PasswordHash: "hash-lain",
		},
	}}
	providers := newFakeProviderRepo()
	providers.links["google:taken"] = &model.UserProvider{
		BaseModel:       model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 9}},
		UserID:          1,
		Provider:        string(model.ProviderGoogle),
		ProviderSubject: "taken",
	}
	svc := NewOAuthService(users, providers)

	err := svc.LinkProvider(2, string(model.ProviderGoogle), "taken")
	if !errors.Is(err, ErrProviderTaken) {
		t.Fatalf("error = %v, want ErrProviderTaken", err)
	}
}

func TestLinkProvider_UnknownUser(t *testing.T) {
	_, _, svc := newOAuthTest(t)

	// User id 99 tidak ada di repo — harus ditolak, bukan membuat row provider
	// yang menggantung ke akun tak dikenal.
	err := svc.LinkProvider(99, string(model.ProviderGoogle), "google-ghost")
	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("error = %v, want ErrUserNotFound", err)
	}
}

func TestUnlinkProvider_BlockedForLastLoginMethod(t *testing.T) {
	users, providers, svc := newOAuthTest(t)
	// User 1: tanpa password + satu provider Google → unlink harus ditolak.
	users.users[1].PasswordHash = ""
	providers.links["google:only"] = &model.UserProvider{
		BaseModel:       model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
		UserID:          1,
		Provider:        string(model.ProviderGoogle),
		ProviderSubject: "only",
	}

	err := svc.UnlinkProvider(1, string(model.ProviderGoogle))
	if !errors.Is(err, ErrLastLoginMethod) {
		t.Fatalf("error = %v, want ErrLastLoginMethod", err)
	}
	if _, ok := providers.links["google:only"]; !ok {
		t.Fatal("link tidak boleh dihapus (guard gagal)")
	}
}

func TestUnlinkProvider_AllowedWhenUserHasPassword(t *testing.T) {
	users, providers, svc := newOAuthTest(t)
	users.users[1].PasswordHash = "hash-ada"
	providers.links["google:ok"] = &model.UserProvider{
		BaseModel:       model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
		UserID:          1,
		Provider:        string(model.ProviderGoogle),
		ProviderSubject: "ok",
	}

	if err := svc.UnlinkProvider(1, string(model.ProviderGoogle)); err != nil {
		t.Fatalf("error = %v", err)
	}
	if _, ok := providers.links["google:ok"]; ok {
		t.Fatal("link masih ada setelah unlink")
	}
}
