package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"api/utility"
	"errors"
	"fmt"
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

// dummyPasswordHash — hash bcrypt untuk email TIDAK dikenal. Dipakai login
// agar waktu respons setara dengan akun yang ada (anti timing-attack
// enumeration). Dihasilkan sekali saat init; biayanya setara DefaultCost.
var dummyPasswordHash = func() []byte {
	h, err := bcrypt.GenerateFromPassword([]byte("dummy-password-untuk-timing"), bcrypt.DefaultCost)
	if err != nil {
		panic("gagal membuat dummy hash: " + err.Error())
	}
	return h
}()

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
	// UpdateProfile — edit nama (E-PROFILE-2026 R6).
	UpdateProfile(userID uint, name string) (*dto.UserResponse, error)
	// ChangePassword — ganti password dengan verifikasi password lama (OWASP
	// re-auth). Sukses → hash baru + PasswordChangedAt + revoke semua sesi
	// KECUALI current (keepRefreshRaw = nilai cookie refresh sesi ini).
	ChangePassword(userID uint, currentPassword, newPassword, keepRefreshRaw string) error
	// SetPassword — set password untuk akun tanpa password (Google-only),
	// prasyarat unlink. Ditolak (ErrPasswordAlreadySet) bila sudah punya
	// password. Sama: revoke semua sesi kecuali current.
	SetPassword(userID uint, newPassword, keepRefreshRaw string) error
	// DeleteAccount — hapus akun: verifikasi password bila ada (Google-only
	// cukup sesi aktif), revoke semua sesi, hapus provider rows, cascade
	// soft-delete konten user, anonymize email + soft delete user
	// (E-PROFILE-2026 R12).
	DeleteAccount(userID uint, password string) error
}

type userService struct {
	userRepository repository.UserRepository
	providerRepo   repository.UserProviderRepository
	refreshRepo    repository.RefreshTokenRepository
	songRepo       repository.SongRepository
	sampleRepo     repository.SampleRepository
}

func NewUserService(
	userRepository repository.UserRepository,
	providerRepo repository.UserProviderRepository,
	refreshRepo repository.RefreshTokenRepository,
	songRepo repository.SongRepository,
	sampleRepo repository.SampleRepository,
) UserService {
	return &userService{
		userRepository: userRepository,
		providerRepo:   providerRepo,
		refreshRepo:    refreshRepo,
		songRepo:       songRepo,
		sampleRepo:     sampleRepo,
	}
}

// userProviders memuat daftar provider terhubung (mis. ["google"]) — untuk
// respons GET /users (E-PROFILE-2026 R14). Gagal baca → daftar kosong (tidak
// menggagalkan profil).
func (s *userService) userProviders(userID uint) []string {
	links, err := s.providerRepo.ListByUserID(userID)
	if err != nil {
		return []string{}
	}
	out := make([]string, 0, len(links))
	for _, l := range links {
		out = append(out, l.Provider)
	}
	return out
}

func toUserResponse(user *model.User, providers []string) *dto.UserResponse {
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
		HasPassword:   user.PasswordHash != "",
		Providers:     providers,
	}
}

func (s *userService) GetUserByEmail(email string) (*dto.UserResponse, error) {
	user, err := s.userRepository.FindByEmail(email)
	if err != nil {
		return nil, ErrUserNotFound
	}
	return toUserResponse(user, s.userProviders(user.ID)), nil
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
	return toUserResponse(user, nil), nil
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
		// Timing: jalankan bcrypt compare dummy agar waktu respons setara
		// dengan akun yang terdaftar (anti enumerasi via waktu).
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(password))
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

	return toUserResponse(user, s.userProviders(user.ID)), nil
}

// revokeOtherSessions mencabut seluruh sesi user kecuali yang sedang dipakai
// (keepRefreshRaw = nilai cookie refresh current). Error dikembalikan — sesi
// lama yang hidup setelah ganti password adalah pelanggaran requirement
// (konsisten dengan PasswordResetService.ResetPassword).
func (s *userService) revokeOtherSessions(userID uint, keepRefreshRaw string) error {
	keepHash := ""
	if keepRefreshRaw != "" {
		keepHash = utility.HashToken(keepRefreshRaw)
	}
	return s.refreshRepo.RevokeAllByUserIDExcept(userID, keepHash)
}

// UpdateProfile mengubah nama user (E-PROFILE-2026 R6). Hanya nama — email,
// role, password tidak tersentuh.
func (s *userService) UpdateProfile(userID uint, name string) (*dto.UserResponse, error) {
	user, err := s.userRepository.FindByID(userID)
	if err != nil {
		return nil, ErrUserNotFound
	}
	user.Name = name
	if err := s.userRepository.Save(user); err != nil {
		return nil, err
	}
	return toUserResponse(user, s.userProviders(user.ID)), nil
}

// ChangePassword mengganti password dengan verifikasi password lama (OWASP
// re-authentication, E-PROFILE-2026 R7). Sesi lain dicabut; sesi current tetap.
func (s *userService) ChangePassword(userID uint, currentPassword, newPassword, keepRefreshRaw string) error {
	user, err := s.userRepository.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	if user.PasswordHash == "" {
		return ErrNoPassword // akun Google-only — arahkan ke set-password
	}
	// Policy password (NIST, E-AUTH-2026 R11) — validasi SEBELUM menyentuh state.
	if len(newPassword) < 8 || len(newPassword) > 72 {
		return ErrWeakPassword
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return ErrInvalidCredentials
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	now := time.Now()
	user.PasswordHash = string(hash)
	user.PasswordChangedAt = &now
	if err := s.userRepository.Save(user); err != nil {
		return err
	}
	return s.revokeOtherSessions(userID, keepRefreshRaw)
}

// SetPassword memasang password untuk akun tanpa password (Google-only),
// prasyarat unlink Google (E-PROFILE-2026 R8). Ditolak bila sudah punya
// password — arahkan ke ChangePassword.
func (s *userService) SetPassword(userID uint, newPassword, keepRefreshRaw string) error {
	user, err := s.userRepository.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	if user.PasswordHash != "" {
		return ErrPasswordAlreadySet
	}
	if len(newPassword) < 8 || len(newPassword) > 72 {
		return ErrWeakPassword
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	now := time.Now()
	user.PasswordHash = string(hash)
	user.PasswordChangedAt = &now
	if err := s.userRepository.Save(user); err != nil {
		return err
	}
	return s.revokeOtherSessions(userID, keepRefreshRaw)
}

// DeleteAccount menghapus akun (E-PROFILE-2026 R12, keputusan V3):
// verifikasi password bila ada → revoke semua sesi → hapus provider rows →
// cascade soft-delete konten user → anonymize email/name → soft delete user.
// Template sistem (user_id NULL, is_system_template=true) tidak tersentuh.
// Kegagalan pada langkah sebelum anonimisasi DIBERITAHUKAN (error dikembalikan,
// user tidak jadi dihapus) — menghindari akun terhapus tapi konten yatim.
func (s *userService) DeleteAccount(userID uint, password string) error {
	user, err := s.userRepository.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	// Re-authentication (OWASP): akun ber-password wajib memasukkan password.
	// Akun Google-only tidak punya password — sesi aktif sudah cukup (V2-A).
	if user.PasswordHash != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
			return ErrInvalidCredentials
		}
	}

	// Hapus semua sesi + provider links (review finding #2: row provider yang
	// menggantung ke user soft-deleted mengunci akun Google selamanya).
	if err := s.refreshRepo.RevokeAllByUserID(userID); err != nil {
		return err
	}
	if err := s.providerRepo.DeleteAllByUserID(userID); err != nil {
		return err
	}

	// Cascade soft-delete konten milik user (mengikuti pola DeleteSectionsBySongID
	// dkk). Template sistem dikecualikan oleh ListByUserID (is_system_template=false).
	if songs, err := s.songRepo.ListByUserID(userID); err != nil {
		return err
	} else {
		for _, song := range songs {
			for _, fn := range []func(uint) error{
				s.songRepo.DeleteSectionsBySongID,
				s.songRepo.DeletePartsBySongID,
				s.songRepo.DeleteSlotsBySongID,
				s.songRepo.Delete,
			} {
				if err := fn(song.ID); err != nil {
					return err
				}
			}
		}
	}
	if samples, err := s.sampleRepo.ListByUserID(userID, nil); err != nil {
		return err
	} else {
		for _, sample := range samples {
			if err := s.sampleRepo.Delete(sample.ID); err != nil {
				return err
			}
		}
	}

	// Anonimisasi PII lalu soft delete — email asli dibebaskan untuk daftar ulang
	// (unique constraint) tanpa menyimpan data pribadi user yang sudah hapus.
	user.Email = fmt.Sprintf("deleted-%d@bandjari.local", user.ID)
	user.Name = "Akun Terhapus"
	if err := s.userRepository.Save(user); err != nil {
		return err
	}
	return s.userRepository.Delete(user.ID)
}
