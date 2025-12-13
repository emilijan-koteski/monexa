package services

import (
	"context"
	"errors"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"gorm.io/gorm"
)

type SettingService struct {
	db *gorm.DB
}

func NewSettingService(db *gorm.DB) *SettingService {
	return &SettingService{db: db}
}

func (s *SettingService) GetByUserID(ctx context.Context, userID uint) (*models.Setting, error) {
	var setting models.Setting
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		First(&setting).
		Error; err != nil {
		return nil, err
	}

	return &setting, nil
}

func (s *SettingService) Update(ctx context.Context, req requests.SettingRequest) (*models.Setting, error) {
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}

	setting, err := s.GetByUserID(ctx, *req.UserID)
	if err != nil {
		return nil, err
	}

	if req.Language != nil && types.IsValidLanguageType(*req.Language) {
		setting.Language = *req.Language
	}
	if req.Currency != nil && types.IsValidCurrencyType(*req.Currency) {
		setting.Currency = *req.Currency
	}

	if err = s.db.WithContext(ctx).Save(&setting).Error; err != nil {
		return nil, err
	}

	return setting, nil
}
