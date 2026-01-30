package services

import (
	"context"
	"errors"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"gorm.io/gorm"
)

type PaymentMethodService struct {
	db *gorm.DB
}

func NewPaymentMethodService(db *gorm.DB) *PaymentMethodService {
	return &PaymentMethodService{db: db}
}

func (s *PaymentMethodService) GetByExample(ctx context.Context, example models.PaymentMethod) (*models.PaymentMethod, error) {
	var paymentMethod models.PaymentMethod
	if err := s.db.WithContext(ctx).
		Where(&example).
		First(&paymentMethod).
		Error; err != nil {
		return nil, err
	}

	return &paymentMethod, nil
}

func (s *PaymentMethodService) GetAllByExample(ctx context.Context, example models.PaymentMethod) ([]models.PaymentMethod, error) {
	var paymentMethods []models.PaymentMethod
	if err := s.db.WithContext(ctx).
		Where(&example).
		Find(&paymentMethods).
		Error; err != nil {
		return nil, err
	}

	return paymentMethods, nil
}

func (s *PaymentMethodService) Create(ctx context.Context, req requests.PaymentMethodRequest) (*models.PaymentMethod, error) {
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}
	if req.Name == nil || *req.Name == "" {
		return nil, errors.New("invalid name")
	}

	paymentMethod := models.PaymentMethod{
		UserID: *req.UserID,
		Name:   *req.Name,
	}

	if err := s.db.WithContext(ctx).Create(&paymentMethod).Error; err != nil {
		return nil, err
	}

	return &paymentMethod, nil
}

func (s *PaymentMethodService) Update(ctx context.Context, req requests.PaymentMethodRequest) (*models.PaymentMethod, error) {
	if req.ID == nil || *req.ID == 0 {
		return nil, errors.New("invalid payment method id")
	}
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}

	paymentMethod, err := s.GetByExample(ctx, models.PaymentMethod{ID: *req.ID})
	if err != nil {
		return nil, err
	}

	if req.Name != nil && *req.Name != "" {
		paymentMethod.Name = *req.Name
	}

	if err = s.db.WithContext(ctx).Save(&paymentMethod).Error; err != nil {
		return nil, err
	}

	return paymentMethod, nil
}

func (s *PaymentMethodService) Delete(ctx context.Context, paymentMethodID uint) error {
	var count int64
	if err := s.db.WithContext(ctx).Model(&models.Record{}).Where("payment_method_id = ?", paymentMethodID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("cannot delete payment method that is referenced by active records")
	}

	if err := s.db.WithContext(ctx).Where("id = ?", paymentMethodID).Delete(&models.PaymentMethod{}).Error; err != nil {
		return err
	}
	return nil
}

func (s *PaymentMethodService) IsOwner(ctx context.Context, userID uint, paymentMethodID uint) (bool, error) {
	var paymentMethod models.PaymentMethod
	err := s.db.WithContext(ctx).
		Select("user_id").
		Where("id = ?", paymentMethodID).
		First(&paymentMethod).Error

	if err != nil {
		return false, err
	}

	return paymentMethod.UserID == userID, nil
}
