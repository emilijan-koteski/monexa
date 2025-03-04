package services

import (
	"context"
	"errors"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"gorm.io/gorm"
)

type RecordService struct {
	db *gorm.DB
}

func NewRecordService(db *gorm.DB) *RecordService {
	return &RecordService{db: db}
}

func (s *RecordService) Create(ctx context.Context, req requests.RecordRequest) (*models.Record, error) {
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}
	if req.CategoryID == nil || *req.CategoryID == 0 {
		return nil, errors.New("invalid category id")
	}
	if req.PaymentMethodID == nil || *req.PaymentMethodID == 0 {
		return nil, errors.New("invalid payment method id")
	}
	if req.Date == nil {
		return nil, errors.New("invalid date")
	}
	if req.Amount == nil {
		return nil, errors.New("invalid amount")
	}
	if req.Currency == nil || !types.IsValidCurrencyType(*req.Currency) {
		return nil, errors.New("invalid currency")
	}

	record := models.Record{
		UserID:          *req.UserID,
		CategoryID:      *req.CategoryID,
		PaymentMethodID: *req.PaymentMethodID,
		Amount:          *req.Amount,
		Currency:        *req.Currency,
		Date:            *req.Date,
	}

	if req.Description != nil && *req.Description != "" {
		record.Description = req.Description
	}

	if err := s.db.WithContext(ctx).Create(&record).Error; err != nil {
		return nil, err
	}

	return &record, nil
}
