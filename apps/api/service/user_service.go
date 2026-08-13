package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"errors"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserNotFound       = errors.New("user not found")
	ErrEmailTaken         = errors.New("email already exists")
	ErrInvalidCredentials = errors.New("invalid email or password")
)

type UserService interface {
	GetUserByEmail(email string) (*dto.UserResponse, error)
	CreateUser(req dto.CreateUserRequest) (*dto.UserResponse, error)
	LoginUser(email, password string) (*dto.UserResponse, error)
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
	return &dto.UserResponse{
		ID:    user.ID,
		Name:  user.Name,
		Email: user.Email,
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
	}
	if err := s.userRepository.Create(user); err != nil {
		return nil, err
	}
	return toUserResponse(user), nil
}

func (s *userService) LoginUser(email, password string) (*dto.UserResponse, error) {
	user, err := s.userRepository.FindByEmail(email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return toUserResponse(user), nil
}
