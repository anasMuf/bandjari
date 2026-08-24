package service

import (
	"api/dto"
	"api/model"
	"errors"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

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

// Password policy (E-AUTH-2026 R11, NIST SP 800-63B): min 8, max 72 byte
// (72 = batas bcrypt). Cek di SERVICE sebagai defense in depth — validasi DTO
// bisa dilewati bila service dipanggil langsung.
func TestCreateUser_RejectsShortPassword(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{}}
	svc := NewUserService(repo)

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
	svc := NewUserService(repo)

	long := strings.Repeat("a", 73)
	_, err := svc.CreateUser(dto.CreateUserRequest{Name: "X", Email: "a@mail.com", Password: long})
	if !errors.Is(err, ErrWeakPassword) {
		t.Fatalf("err = %v, want ErrWeakPassword (73 byte)", err)
	}
}

func TestCreateUser_AcceptsLongPassphrase(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{}}
	svc := NewUserService(repo)

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
	svc := NewUserService(repo)

	_, err := svc.CreateUser(dto.CreateUserRequest{Name: "X", Email: "ada@mail.com", Password: "secret123"})
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("err = %v, want ErrEmailTaken", err)
	}
}

func TestCreateUser_HashesPassword(t *testing.T) {
	repo := &fakeUserRepo{users: map[string]*model.User{}}
	svc := NewUserService(repo)

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
	svc := NewUserService(&fakeUserRepo{users: map[string]*model.User{}})
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
	svc := NewUserService(repo)
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
	svc := NewUserService(repo)
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
	svc := NewUserService(repo)

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
	svc := NewUserService(repo)

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
	svc := NewUserService(repo)

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
	svc := NewUserService(repo)

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
	svc := NewUserService(repo)

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
