package service

import (
	"api/dto"
	"api/model"
	"errors"
	"testing"

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
