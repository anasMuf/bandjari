package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserNotFound       = errors.New("user not found")
	ErrEmailTaken         = errors.New("email already exists")
	ErrInvalidCredentials = errors.New("invalid email or password")
	// ErrWeakPassword — password policy NIST SP 800-63B (E-AUTH-2026 R11):
	// min 8, maks 72 byte (72 = batas bcrypt).
	ErrWeakPassword = errors.New("password minimal 8 dan maksimal 72 karakter")
)

const (
	// MaxLoginAttempts — ambang kegagalan sebelum akun dikunci (E-AUTH-2026 R8).
	MaxLoginAttempts = 5
)

// Metode autentikasi akun — dipakai endpoint check-email (email-first login).
const (
	AuthMethodPassword = "password" // akun punya password (login biasa)
	AuthMethodGoogle   = "google"   // akun dibuat via Google (tanpa password)
	AuthMethodNone     = "none"     // email tidak terdaftar
)

// lockDuration — durasi kunci akun progressive: makin sering gagal berturut-
// turut (tanpa sukses), makin lama terkunci: 15m → 30m → 1h.
func lockDuration(attempts int) time.Duration {
	switch {
	case attempts >= 15:
		return time.Hour
	case attempts >= 10:
		return 30 * time.Minute
	default:
		return 15 * time.Minute
	}
}

type UserService interface {
	GetUserByEmail(email string) (*dto.UserResponse, error)
	CreateUser(req dto.CreateUserRequest) (*dto.UserResponse, error)
	LoginUser(email, password string) (*dto.UserResponse, error)
	// CheckEmailMethod — metode login untuk email (email-first login).
	CheckEmailMethod(email string) (string, error)
}

type userService struct {
	userRepository repository.UserRepository
}

func NewUserService(userRepository repository.UserRepository) UserService {
	return &userService{
		userRepository: userRepository,
	}
}

func toUserResponse(user *model.User) *dto.UserResponse {
	role := user.Role
	if role == "" {
		role = string(model.RoleUser) // baris lama tanpa role → user biasa
	}
	return &dto.UserResponse{
		ID:            user.ID,
		Name:          user.Name,
		Email:         user.Email,
		Role:          role,
		EmailVerified: user.EmailVerifiedAt != nil,
	}
}

func (s *userService) GetUserByEmail(email string) (*dto.UserResponse, error) {
	user, err := s.userRepository.FindByEmail(email)
	if err != nil {
		return nil, ErrUserNotFound
	}
	return toUserResponse(user), nil
}

func (s *userService) CreateUser(req dto.CreateUserRequest) (*dto.UserResponse, error) {
	// Defense in depth: validasi DTO bisa dilewati bila service dipanggil
	// langsung — cek ulang di sini (byte-based, relevan untuk batas bcrypt 72).
	if len(req.Password) < 8 || len(req.Password) > 72 {
		return nil, ErrWeakPassword
	}

	_, err := s.userRepository.FindByEmail(req.Email)
	if err == nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &model.User{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         string(model.RoleUser),
	}
	if err := s.userRepository.Create(user); err != nil {
		return nil, err
	}
	return toUserResponse(user), nil
}

// CheckEmailMethod menentukan langkah login yang relevan untuk email tertentu
// (email-first login): password / google / none. Catatan trade-off: endpoint
// ini MENGUNGKAP keberadaan email (anti-enumeration dilonggarkan demi UX) —
// risiko dibatasi rate limit & lockout pada /auth/*.
func (s *userService) CheckEmailMethod(email string) (string, error) {
	user, err := s.userRepository.FindByEmail(email)
	if err != nil {
		return AuthMethodNone, nil
	}
	if user.PasswordHash == "" {
		return AuthMethodGoogle, nil
	}
	return AuthMethodPassword, nil
}

func (s *userService) LoginUser(email, password string) (*dto.UserResponse, error) {
	user, err := s.userRepository.FindByEmail(email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	// Akun Google (tanpa password) tidak bisa login password — beri sinyal
	// khusus agar UX menuntun ke "Masuk dengan Google" (opsi A disetujui).
	if user.PasswordHash == "" {
		return nil, ErrSocialLoginRequired
	}

	// Akun terkunci: tolak SEMUA percobaan (termasuk password benar) dengan
	// pesan seragam — anti-enumeration (E-AUTH-2026 R8). Counter TIDAK
	// bertambah selama lock, agar spam tidak memperpanjang kunci. Sentinel
	// khusus (ErrAccountLocked) agar audit bisa membedakan login_locked.
	if user.LockedUntil != nil && time.Now().Before(*user.LockedUntil) {
		return nil, ErrAccountLocked
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		// Kegagalan: increment counter; setelah MaxLoginAttempts → kunci akun
		// dengan durasi progressive (15m → 30m → 1h).
		user.FailedLoginAttempts++
		if user.FailedLoginAttempts >= MaxLoginAttempts {
			until := time.Now().Add(lockDuration(user.FailedLoginAttempts))
			user.LockedUntil = &until
		}
		_ = s.userRepository.Save(user)
		return nil, ErrInvalidCredentials
	}

	// Sukses → reset counter & lock.
	if user.FailedLoginAttempts != 0 || user.LockedUntil != nil {
		user.FailedLoginAttempts = 0
		user.LockedUntil = nil
		_ = s.userRepository.Save(user)
	}

	return toUserResponse(user), nil
}
