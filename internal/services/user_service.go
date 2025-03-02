package services

import (
	"context"
	"github.com/emilijan-koteski/monexa/internal/models"
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
