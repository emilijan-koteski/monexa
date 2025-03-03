package services

import (
	"context"
	"errors"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
)

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

func (s *UserService) GetUserByExample(ctx context.Context, example models.User) (*models.User, error) {
	var user models.User
	if err := s.db.WithContext(ctx).
		Where(&example).
		First(&user).
		Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *UserService) CreateUser(ctx context.Context, req requests.RegisterRequest) (*models.User, error) {
	if req.Email == "" || req.Password == "" || req.Name == "" {
		return nil, errors.New("email, password and name are required")
	}

	tx := s.db.WithContext(ctx).Begin()

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var existingUser models.User
	if err := tx.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		tx.Rollback()
		return nil, errors.New("email already registered")
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	user := models.User{
		Email:    req.Email,
		Password: hashedPassword,
		Name:     req.Name,
	}

	if err = tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	setting := models.Setting{
		UserID:   user.ID,
		Language: types.EnglishLanguage,
		Currency: types.MacedonianDenar,
	}

	if err = tx.Create(&setting).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	paymentMethods := []models.PaymentMethod{
		{UserID: user.ID, Name: "Cash"},
		{UserID: user.ID, Name: "Card"},
	}

	if err = tx.Create(&paymentMethods).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, err
	}

	user.Settings = &setting
	user.PaymentMethods = &paymentMethods

	return &user, nil
}
