package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"errors"

	"golang.org/x/crypto/bcrypt"
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

func (s *userService) GetUserByEmail(email string) (*dto.UserResponse, error) {
	user, err := s.userRepository.FindByEmail(email)
	if err != nil {
		return nil, errors.New("user not found")
	}
	return &dto.UserResponse{
		ID:       user.ID,
		FullName: user.FullName,
		Username: user.Username,
		Email:    user.Email,
		Phone:    user.Phone,
		Address:  user.Address,
		Role:     user.Role,
		Deposit:  user.Deposit,
	}, nil
}

func (s *userService) CreateUser(req dto.CreateUserRequest) (*dto.UserResponse, error) {
	_, err := s.userRepository.FindByEmail(req.Email)
	if err == nil {
		return nil, errors.New("email already exists")
	}
	_, err = s.userRepository.FindByUsername(req.Username)
	if err == nil {
		return nil, errors.New("username not found")
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)

	user := &model.User{
		FullName: req.FullName,
		Username: req.Username,
		Email:    req.Email,
		Password: string(hash),
		Phone:    req.Phone,
		Address:  req.Address,
		Role:     "customer", // Default role
		Deposit:  0,          // Default deposit
	}
	if err := s.userRepository.Create(user); err != nil {
		return nil, err
	}
	return &dto.UserResponse{
		ID:       user.ID,
		FullName: user.FullName,
		Username: user.Username,
		Email:    user.Email,
		Phone:    user.Phone,
		Address:  user.Address,
		Role:     user.Role,
		Deposit:  user.Deposit,
	}, nil
}

func (s *userService) LoginUser(email, password string) (*dto.UserResponse, error) {
	user, err := s.userRepository.FindByEmail(email)
	if err != nil {
		return nil, errors.New("user not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, errors.New("invalid password")
	}

	return &dto.UserResponse{
		ID:       user.ID,
		FullName: user.FullName,
		Username: user.Username,
		Email:    user.Email,
		Phone:    user.Phone,
		Address:  user.Address,
		Role:     user.Role,
		Deposit:  user.Deposit,
	}, nil
}
