package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"api/utility"
	"errors"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// testUserService membungkus NewUserService dengan fake provider + refresh + song
// + sample repo kosong — test lama cukup mengganti pemanggilan tanpa fake di tiap kasus.
func testUserService(userRepo repository.UserRepository) UserService {
	return NewUserService(userRepo, newFakeProviderRepo(), newFakeRefreshRepo(), &fakeSongRepo{}, &fakeSampleRepo{})
}

type fakeUserRepo struct {
	users map[string]*model.User
}

func (f *fakeUserRepo) FindByEmail(email string) (*model.User, error) {
	if u, ok := f.users[email]; ok {
		return u, nil
	}
	return nil, errors.New("not found")
}

func (f *fakeUserRepo) FindByID(id uint) (*model.User, error) {
	for _, u := range f.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (f *fakeUserRepo) Create(u *model.User) error {
	if _, ok := f.users[u.Email]; ok {
		return errors.New("duplicate")
	}
	f.users[u.Email] = u
	return nil
}

func (f *fakeUserRepo) Save(u *model.User) error {
	// Keyed by email — saat email berubah (mis. anonimisasi delete-account),
	// buang entry lama (by ID) lalu simpan ulang under email baru.
	for email, existing := range f.users {
		if existing.ID == u.ID {
			delete(f.users, email)
		}
	}
	f.users[u.Email] = u
	return nil
}

func (f *fakeUserRepo) FindByVerificationTokenHash(hash string) (*model.User, error) {
	for _, u := range f.users {
		if u.VerificationTokenHash == hash {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (f *fakeUserRepo) FindByResetTokenHash(hash string) (*model.User, error) {
	for _, u := range f.users {
		if u.ResetTokenHash == hash {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (f *fakeUserRepo) Delete(userID uint) error {
	for email, u := range f.users {
		if u.ID == userID {
			delete(f.users, email)
		}
	}
	return nil
}

// Password policy (E-AUTH-2026 R11, NIST SP 800-63B): min 8, max 72 byte
// (72 = batas bcrypt). Cek di SERVICE sebagai defense in depth — validasi DTO
// bisa dilewati bila service dipanggil langsung.
func TestCreateUser_RejectsShortPassword(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{}}
	svc := testUserService(repo)

	_, err := svc.CreateUser(dto.CreateUserRequest{Name: "X", Email: "a@mail.com", Password: "1234567"})
	if !errors.Is(err, ErrWeakPassword) {
		t.Fatalf("err = %v, want ErrWeakPassword (7 karakter)", err)
	}
	if len(repo.users) != 0 {
		t.Fatal("user tidak boleh dibuat saat password ditolak")
	}
}

func TestCreateUser_RejectsTooLongPassword(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{}}
	svc := testUserService(repo)

	long := strings.Repeat("a", 73)
	_, err := svc.CreateUser(dto.CreateUserRequest{Name: "X", Email: "a@mail.com", Password: long})
	if !errors.Is(err, ErrWeakPassword) {
		t.Fatalf("err = %v, want ErrWeakPassword (73 byte)", err)
	}
}

func TestCreateUser_AcceptsLongPassphrase(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{}}
	svc := testUserService(repo)

	// Passphrase panjang tanpa simbol — sah menurut NIST (fokus panjang, bukan komposisi).
	pass := "ini kalimat sandi yang panjang sekali"
	res, err := svc.CreateUser(dto.CreateUserRequest{Name: "X", Email: "a@mail.com", Password: pass})
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	if res.Email != "a@mail.com" {
		t.Fatalf("response tidak sesuai: %+v", res)
	}
}

func TestCreateUser_RejectsDuplicateEmail(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{
		"ada@mail.com": {Email: "ada@mail.com"},
	}}
	svc := testUserService(repo)

	_, err := svc.CreateUser(dto.CreateUserRequest{Name: "X", Email: "ada@mail.com", Password: "secret123"})
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("err = %v, want ErrEmailTaken", err)
	}
}

func TestCreateUser_HashesPassword(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{}}
	svc := testUserService(repo)

	res, err := svc.CreateUser(dto.CreateUserRequest{Name: "Anas", Email: "anas@mail.com", Password: "secret123"})
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	if res.Email != "anas@mail.com" || res.Name != "Anas" {
		t.Fatalf("response tidak sesuai: %+v", res)
	}
	stored := repo.users["anas@mail.com"]
	if stored.PasswordHash == "secret123" {
		t.Fatal("password tersimpan plaintext")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(stored.PasswordHash), []byte("secret123")); err != nil {
		t.Fatalf("hash tidak valid: %v", err)
	}
}

func TestLoginUser_UnknownEmail(t *testing.T) {
	svc := testUserService(&fakeUserRepo{users: map[string]*model.User{}})
	_, err := svc.LoginUser("x@mail.com", "pw")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestLoginUser_WrongPassword(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("benar123"), bcrypt.DefaultCost)
	repo := &fakeUserRepo{users: map[string]*model.User{
		"u@mail.com": {Email: "u@mail.com", PasswordHash: string(hash)},
	}}
	svc := testUserService(repo)
	_, err := svc.LoginUser("u@mail.com", "salah123")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestLoginUser_Success(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("benar123"), bcrypt.DefaultCost)
	repo := &fakeUserRepo{users: map[string]*model.User{
		"u@mail.com": {Email: "u@mail.com", Name: "Udin", PasswordHash: string(hash)},
	}}
	svc := testUserService(repo)
	res, err := svc.LoginUser("u@mail.com", "benar123")
	if err != nil {
		t.Fatalf("LoginUser() error = %v", err)
	}
	if res.Email != "u@mail.com" {
		t.Fatalf("response tidak sesuai: %+v", res)
	}
}

// Akun yang dibuat via Google punya PasswordHash kosong — login password harus
// menolak dengan sinyal khusus agar UX bisa menuntun user ke "Masuk dengan Google".
func TestLoginUser_GoogleAccountRequiresGoogle(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{
		"google@mail.com": {Email: "google@mail.com", Name: "G", PasswordHash: ""},
	}}
	svc := testUserService(repo)

	_, err := svc.LoginUser("google@mail.com", "password-apapun")
	if !errors.Is(err, ErrSocialLoginRequired) {
		t.Fatalf("err = %v, want ErrSocialLoginRequired", err)
	}
}

// CheckEmailMethod — dasar email-first login: tentukan langkah yang relevan
// (password / google / none) tanpa mencoba password.
func TestCheckEmailMethod(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("benar123"), bcrypt.DefaultCost)
	repo := &fakeUserRepo{users: map[string]*model.User{
		"pw@mail.com":     {Email: "pw@mail.com", PasswordHash: string(hash)},
		"google@mail.com": {Email: "google@mail.com", PasswordHash: ""},
	}}
	svc := testUserService(repo)

	if got, err := svc.CheckEmailMethod("pw@mail.com"); err != nil || got != AuthMethodPassword {
		t.Fatalf("CheckEmailMethod(pw) = %q, %v; want %q", got, err, AuthMethodPassword)
	}
	if got, err := svc.CheckEmailMethod("google@mail.com"); err != nil || got != AuthMethodGoogle {
		t.Fatalf("CheckEmailMethod(google) = %q, %v; want %q", got, err, AuthMethodGoogle)
	}
	if got, err := svc.CheckEmailMethod("none@mail.com"); err != nil || got != AuthMethodNone {
		t.Fatalf("CheckEmailMethod(none) = %q, %v; want %q", got, err, AuthMethodNone)
	}
}

// --- Account lockout (E-AUTH-2026 R8) ---

func TestLockDurationProgressive(t *testing.T) {
	tests := []struct {
		attempts int
		want     time.Duration
	}{
		{5, 15 * time.Minute},
		{9, 15 * time.Minute},
		{10, 30 * time.Minute},
		{14, 30 * time.Minute},
		{15, time.Hour},
		{100, time.Hour},
	}
	for _, tt := range tests {
		if got := lockDuration(tt.attempts); got != tt.want {
			t.Errorf("lockDuration(%d) = %v, want %v", tt.attempts, got, tt.want)
		}
	}
}

func TestLoginUser_LocksAfterFiveFailures(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("benar123"), bcrypt.DefaultCost)
	repo := &fakeUserRepo{users: map[string]*model.User{
		"u@mail.com": {Email: "u@mail.com", PasswordHash: string(hash)},
	}}
	svc := testUserService(repo)

	for i := 0; i < 5; i++ {
		if _, err := svc.LoginUser("u@mail.com", "salah"); !errors.Is(err, ErrInvalidCredentials) {
			t.Fatalf("percobaan %d: err = %v", i+1, err)
		}
	}

	// Percobaan ke-6 dengan password BENAR tetap ditolak — akun terkunci.
	if _, err := svc.LoginUser("u@mail.com", "benar123"); !errors.Is(err, ErrAccountLocked) {
		t.Fatalf("percobaan ke-6 (password benar): err = %v, want ErrAccountLocked", err)
	}

	stored := repo.users["u@mail.com"]
	if stored.FailedLoginAttempts != 5 {
		t.Fatalf("failed attempts = %d, want 5 (counter berhenti selama lock)", stored.FailedLoginAttempts)
	}
	if stored.LockedUntil == nil || time.Until(*stored.LockedUntil) <= 0 {
		t.Fatal("locked_until harus di masa depan")
	}
}

func TestLoginUser_LockExpires_LoginSucceedsAndResets(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("benar123"), bcrypt.DefaultCost)
	past := time.Now().Add(-time.Minute)
	repo := &fakeUserRepo{users: map[string]*model.User{
		"u@mail.com": {
			Email:               "u@mail.com",
			PasswordHash:        string(hash),
			FailedLoginAttempts: 5,
			LockedUntil:         &past,
		},
	}}
	svc := testUserService(repo)

	res, err := svc.LoginUser("u@mail.com", "benar123")
	if err != nil {
		t.Fatalf("LoginUser() error = %v (lock sudah lewat)", err)
	}
	if res.Email != "u@mail.com" {
		t.Fatalf("response tidak sesuai: %+v", res)
	}
	stored := repo.users["u@mail.com"]
	if stored.FailedLoginAttempts != 0 {
		t.Fatalf("counter harus reset setelah sukses, got %d", stored.FailedLoginAttempts)
	}
	if stored.LockedUntil != nil {
		t.Fatal("locked_until harus dibersihkan setelah sukses")
	}
}

func TestLoginUser_UnknownEmailDoesNotLock(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{}}
	svc := testUserService(repo)

	for i := 0; i < 10; i++ {
		if _, err := svc.LoginUser("tidak-ada@mail.com", "salah"); !errors.Is(err, ErrInvalidCredentials) {
			t.Fatalf("percobaan %d: err = %v", i+1, err)
		}
	}
	// Email tidak dikenal tidak pernah di-lock — anti-enumeration (tidak ada
	// sinyal berbeda untuk email yang tidak terdaftar).
	if len(repo.users) != 0 {
		t.Fatal("tidak boleh ada user yang dibuat/diubah")
	}
}

func TestGetUserByEmail_IncludesHasPasswordAndProviders(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{
		"pw@mail.com": {
			BaseModel:    model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
			Email:        "pw@mail.com",
			Name:         "P",
			PasswordHash: "hash",
		},
	}}
	svc := NewUserService(repo, &fakeProviderRepo{links: map[string]*model.UserProvider{
		"google:sub-1": {
			BaseModel:       model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
			UserID:          1,
			Provider:        "google",
			ProviderSubject: "sub-1",
		},
	}}, newFakeRefreshRepo(), &fakeSongRepo{}, &fakeSampleRepo{})

	res, err := svc.GetUserByEmail("pw@mail.com")
	if err != nil {
		t.Fatalf("GetUserByEmail() error = %v", err)
	}
	if !res.HasPassword {
		t.Fatal("has_password harus true untuk akun ber-password")
	}
	if len(res.Providers) != 1 || res.Providers[0] != "google" {
		t.Fatalf("providers = %v, want [google]", res.Providers)
	}
}

func TestGetUserByEmail_GoogleOnlyAccount(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{
		"g@mail.com": {Email: "g@mail.com", Name: "G", PasswordHash: ""},
	}}
	svc := NewUserService(repo, newFakeProviderRepo(), newFakeRefreshRepo(), &fakeSongRepo{}, &fakeSampleRepo{})

	res, err := svc.GetUserByEmail("g@mail.com")
	if err != nil {
		t.Fatalf("GetUserByEmail() error = %v", err)
	}
	if res.HasPassword {
		t.Fatal("akun Google-only harus has_password = false")
	}
	if len(res.Providers) != 0 {
		t.Fatalf("providers = %v, want []", res.Providers)
	}
}

// --- E-PROFILE-2026 Task 2: UpdateProfile / ChangePassword / SetPassword ---

func TestUpdateProfile_ChangesNameOnly(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{
		"a@mail.com": {BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, Email: "a@mail.com", Name: "Lama", Role: "user"},
	}}
	svc := testUserService(repo)

	res, err := svc.UpdateProfile(1, "Nama Baru")
	if err != nil {
		t.Fatalf("UpdateProfile() error = %v", err)
	}
	if res.Name != "Nama Baru" {
		t.Fatalf("nama = %q, want Nama Baru", res.Name)
	}
	stored := repo.users["a@mail.com"]
	if stored.Name != "Nama Baru" {
		t.Fatalf("nama tersimpan = %q, want Nama Baru", stored.Name)
	}
	if stored.Email != "a@mail.com" || stored.Role != "user" {
		t.Fatal("email/role tidak boleh berubah saat edit nama")
	}
}

func TestUpdateProfile_UnknownUser(t *testing.T) {
	svc := testUserService(&fakeUserRepo{users: map[string]*model.User{}})

	_, err := svc.UpdateProfile(99, "X")
	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("error = %v, want ErrUserNotFound", err)
	}
}

// userWithPassword membuat fake user id 1 dengan password bcrypt (untuk test
// change-password). Kembalikan password asli agar test bisa verifikasi.
func userWithPassword(t *testing.T) (*fakeUserRepo, string) {
	t.Helper()
	plain := "rahasia123"
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	repo := &fakeUserRepo{users: map[string]*model.User{
		"a@mail.com": {BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, Email: "a@mail.com", Name: "A", PasswordHash: string(hash)},
	}}
	return repo, plain
}

func TestChangePassword_WrongCurrent(t *testing.T) {
	repo, _ := userWithPassword(t)
	svc := testUserService(repo)
	before := repo.users["a@mail.com"].PasswordHash

	err := svc.ChangePassword(1, "salah", "baru1234", "")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("error = %v, want ErrInvalidCredentials", err)
	}
	if repo.users["a@mail.com"].PasswordHash != before {
		t.Fatal("hash tidak boleh berubah saat password lama salah")
	}
}

func TestChangePassword_Success_RevokesOthersKeepsCurrent(t *testing.T) {
	repo, plain := userWithPassword(t)
	refresh := newFakeRefreshRepo()
	// Dua sesi user 1: satu current (akan di-keep), satu lain (harus mati).
	// Key fake = hash asli dari raw cookie (sesuai HashToken di service).
	now := time.Now()
	refresh.tokens[utility.HashToken("raw-current")] = &model.RefreshToken{BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, UserID: 1, TokenHash: utility.HashToken("raw-current"), ExpiresAt: now.Add(time.Hour)}
	refresh.tokens[utility.HashToken("raw-other")] = &model.RefreshToken{BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 2}}, UserID: 1, TokenHash: utility.HashToken("raw-other"), ExpiresAt: now.Add(time.Hour)}
	svc := NewUserService(repo, newFakeProviderRepo(), refresh, &fakeSongRepo{}, &fakeSampleRepo{})

	// keepRefreshRaw = nilai cookie; service menghash-nya → hash raw-current.
	if err := svc.ChangePassword(1, plain, "baru4567", "raw-current"); err != nil {
		t.Fatalf("ChangePassword() error = %v", err)
	}
	u := repo.users["a@mail.com"]
	if u.PasswordHash == "" {
		t.Fatal("password harus berubah")
	}
	if u.PasswordChangedAt == nil {
		t.Fatal("password_changed_at harus terisi")
	}
	// Sesi lain direvoke, sesi current tetap hidup.
	if refresh.tokens[utility.HashToken("raw-current")].RevokedAt != nil {
		t.Fatal("sesi current tidak boleh dicabut")
	}
	if refresh.tokens[utility.HashToken("raw-other")].RevokedAt == nil {
		t.Fatal("sesi lain harus dicabut")
	}
}

func TestChangePassword_NoPasswordAccount(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{
		"g@mail.com": {BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, Email: "g@mail.com", Name: "G"},
	}}
	svc := testUserService(repo)

	err := svc.ChangePassword(1, "apa-saja", "baru1234", "")
	if !errors.Is(err, ErrNoPassword) {
		t.Fatalf("error = %v, want ErrNoPassword", err)
	}
}

func TestChangePassword_WeakPassword(t *testing.T) {
	repo, plain := userWithPassword(t)
	svc := testUserService(repo)
	before := repo.users["a@mail.com"].PasswordHash

	err := svc.ChangePassword(1, plain, "1234567", "")
	if !errors.Is(err, ErrWeakPassword) {
		t.Fatalf("error = %v, want ErrWeakPassword", err)
	}
	if repo.users["a@mail.com"].PasswordHash != before {
		t.Fatal("state tidak boleh berubah saat password ditolak")
	}
}

func TestSetPassword_Success(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{
		"g@mail.com": {BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, Email: "g@mail.com", Name: "G"},
	}}
	refresh := newFakeRefreshRepo()
	now := time.Now()
	refresh.tokens[utility.HashToken("raw-current")] = &model.RefreshToken{BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, UserID: 1, TokenHash: utility.HashToken("raw-current"), ExpiresAt: now.Add(time.Hour)}
	svc := NewUserService(repo, newFakeProviderRepo(), refresh, &fakeSongRepo{}, &fakeSampleRepo{})

	if err := svc.SetPassword(1, "baru4567", "raw-current"); err != nil {
		t.Fatalf("SetPassword() error = %v", err)
	}
	u := repo.users["g@mail.com"]
	if u.PasswordHash == "" {
		t.Fatal("password harus terpasang")
	}
	if u.PasswordChangedAt == nil {
		t.Fatal("password_changed_at harus terisi")
	}
	if refresh.tokens[utility.HashToken("raw-current")].RevokedAt != nil {
		t.Fatal("sesi current tidak boleh dicabut")
	}
}

func TestSetPassword_AlreadyHasPassword(t *testing.T) {
	repo, _ := userWithPassword(t)
	svc := testUserService(repo)

	err := svc.SetPassword(1, "baru4567", "")
	if !errors.Is(err, ErrPasswordAlreadySet) {
		t.Fatalf("error = %v, want ErrPasswordAlreadySet", err)
	}
}

// --- E-PROFILE-2026 Task 3: DeleteAccount ---

func TestDeleteAccount_WrongPassword(t *testing.T) {
	repo, _ := userWithPassword(t)
	svc := testUserService(repo)

	err := svc.DeleteAccount(1, "salah")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("error = %v, want ErrInvalidCredentials", err)
	}
	if _, ok := repo.users["a@mail.com"]; !ok {
		t.Fatal("user tidak boleh dihapus saat password salah")
	}
}

func TestDeleteAccount_Success_SoftDeletesAndAnonymizes(t *testing.T) {
	// User 1 dengan password + provider + sesi + konten.
	repo, plain := userWithPassword(t)
	providers := newFakeProviderRepo()
	providers.links["google:sub"] = &model.UserProvider{
		BaseModel:       model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}},
		UserID:          1,
		Provider:        "google",
		ProviderSubject: "sub",
	}
	refresh := newFakeRefreshRepo()
	now := time.Now()
	refresh.tokens["s1"] = &model.RefreshToken{BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, UserID: 1, TokenHash: "s1", ExpiresAt: now.Add(time.Hour)}
	songRepo := &fakeSongRepo{songs: map[uint]*model.Song{
		1: {BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, UserID: ptrUint(1), Name: "Lagu User", IsSystemTemplate: false},
		2: {BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 2}}, UserID: nil, Name: "Template", IsSystemTemplate: true},
	}}
	sampleRepo := &fakeSampleRepo{samples: map[uint]*model.Sample{
		1: {BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, UserID: ptrUint(1), Name: "Sample User"},
	}}
	svc := NewUserService(repo, providers, refresh, songRepo, sampleRepo)

	if err := svc.DeleteAccount(1, plain); err != nil {
		t.Fatalf("DeleteAccount() error = %v", err)
	}

	// User soft-deleted + email dianonimkan + name diganti.
	if _, ok := repo.users["a@mail.com"]; ok {
		t.Fatal("user harus dihapus dari repo")
	}
	// Provider rows hilang (review finding #2).
	if len(providers.links) != 0 {
		t.Fatalf("provider rows harus dihapus, got %d", len(providers.links))
	}
	// Semua sesi revoked.
	if refresh.tokens["s1"].RevokedAt == nil {
		t.Fatal("semua sesi harus dicabut")
	}
	// Konten user soft-deleted; template sistem TIDAK tersentuh.
	if _, ok := songRepo.songs[1]; ok {
		t.Fatal("song milik user harus dihapus")
	}
	if _, ok := songRepo.songs[2]; !ok {
		t.Fatal("template sistem tidak boleh terhapus")
	}
	if _, ok := sampleRepo.samples[1]; ok {
		t.Fatal("sample milik user harus dihapus")
	}
}

func TestDeleteAccount_GoogleOnly_NoPasswordNeeded(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{
		"g@mail.com": {BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, Email: "g@mail.com", Name: "G"},
	}}
	svc := testUserService(repo)

	// Password kosong — akun Google-only cukup sesi aktif (V2-A).
	if err := svc.DeleteAccount(1, ""); err != nil {
		t.Fatalf("DeleteAccount() error = %v", err)
	}
	if _, ok := repo.users["g@mail.com"]; ok {
		t.Fatal("akun Google-only harus terhapus")
	}
}

func TestDeleteAccount_UnknownUser(t *testing.T) {
	svc := testUserService(&fakeUserRepo{users: map[string]*model.User{}})

	err := svc.DeleteAccount(99, "apa-saja")
	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("error = %v, want ErrUserNotFound", err)
	}
}

// ptrUint helper untuk pointer *uint di model.
func ptrUint(v uint) *uint {
	return &v
}

// --- Jalur kegagalan (review finding): error revoke/cascade harus dipropagasi ---

// failingRefreshRepo — merevoke SELALU gagal (uji propagasi error).
type failingRefreshRepo struct {
	*fakeRefreshRepo
}

func (f *failingRefreshRepo) RevokeAllByUserIDExcept(userID uint, keepTokenHash string) error {
	return errors.New("revoke gagal")
}

func TestChangePassword_RevokeFailurePropagates(t *testing.T) {
	repo, plain := userWithPassword(t)
	before := repo.users["a@mail.com"].PasswordHash
	svc := NewUserService(repo, newFakeProviderRepo(), &failingRefreshRepo{newFakeRefreshRepo()}, &fakeSongRepo{}, &fakeSampleRepo{})

	err := svc.ChangePassword(1, plain, "baru4567", "raw-current")
	if err == nil {
		t.Fatal("gagal revoke harus dikembalikan (bukan diam-diam sukses)")
	}
	// Catatan: password tetap tersimpan (pola sama dengan ResetPassword) — yang
	// diuji adalah error revoke tidak disembunyikan.
	_ = before
}

func TestSetPassword_RevokeFailurePropagates(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{
		"g@mail.com": {BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, Email: "g@mail.com", Name: "G"},
	}}
	svc := NewUserService(repo, newFakeProviderRepo(), &failingRefreshRepo{newFakeRefreshRepo()}, &fakeSongRepo{}, &fakeSampleRepo{})

	err := svc.SetPassword(1, "baru4567", "raw-current")
	if err == nil {
		t.Fatal("gagal revoke harus dikembalikan (bukan diam-diam sukses)")
	}
}

// failingSongRepo — penghapusan song SELALU gagal (uji delete-account berhenti).
type failingSongRepo struct {
	*fakeSongRepo
}

func (f *failingSongRepo) Delete(id uint) error {
	return errors.New("hapus song gagal")
}

func TestDeleteAccount_CascadeFailureAborts(t *testing.T) {
	repo, plain := userWithPassword(t)
	providers := newFakeProviderRepo()
	refresh := newFakeRefreshRepo()
	songRepo := &failingSongRepo{fakeSongRepo: &fakeSongRepo{songs: map[uint]*model.Song{
		1: {BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 1}}, UserID: ptrUint(1), Name: "Lagu", IsSystemTemplate: false},
	}}}
	svc := NewUserService(repo, providers, refresh, songRepo, &fakeSampleRepo{})

	err := svc.DeleteAccount(1, plain)
	if err == nil {
		t.Fatal("gagal cascade harus dikembalikan (bukan hapus akun diam-diam)")
	}
	// User TIDAK jadi dihapus — tidak boleh ada akun terhapus dengan konten yatim.
	if _, ok := repo.users["a@mail.com"]; !ok {
		t.Fatal("user tidak boleh dihapus saat cascade konten gagal")
	}
}

func TestDeleteAccount_ProviderCleanupFailureAborts(t *testing.T) {
	repo, plain := userWithPassword(t)
	refresh := newFakeRefreshRepo()

	// Simulasikan kegagalan cleanup provider.
	failingProviders := &failingProviderRepo{fakeProviderRepo: newFakeProviderRepo()}
	svc := NewUserService(repo, failingProviders, refresh, &fakeSongRepo{}, &fakeSampleRepo{})
	if err := svc.DeleteAccount(1, plain); err == nil {
		t.Fatal("gagal cleanup provider harus dikembalikan")
	}
	if _, ok := repo.users["a@mail.com"]; !ok {
		t.Fatal("user tidak boleh dihapus saat cleanup provider gagal")
	}
}
