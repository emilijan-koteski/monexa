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

func (s *RecordService) GetByExample(ctx context.Context, example models.Record) (*models.Record, error) {
	var record models.Record
	if err := s.db.WithContext(ctx).
		Where(&example).
		First(&record).
		Error; err != nil {
		return nil, err
	}

	return &record, nil
}

func (s *RecordService) GetAll(ctx context.Context, filter requests.RecordFilterRequest) ([]models.Record, error) {
	if filter.UserID == nil || *filter.UserID == 0 {
		return []models.Record{}, errors.New("invalid user id")
	}

	var records []models.Record

	query := s.db.WithContext(ctx).Where("user_id = ?", *filter.UserID)

	if filter.StartDate != nil {
		query = query.Where("date >= ?", *filter.StartDate)
	}
	if filter.EndDate != nil {
		query = query.Where("date <= ?", *filter.EndDate)
	}

	if err := query.Find(&records).Error; err != nil {
		return nil, err
	}

	return records, nil
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

func (s *RecordService) Update(ctx context.Context, req requests.RecordRequest) (*models.Record, error) {
	if req.ID == nil || *req.ID == 0 {
		return nil, errors.New("invalid record id")
	}
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}

	record, err := s.GetByExample(ctx, models.Record{ID: *req.ID})
	if err != nil {
		return nil, err
	}

	if req.CategoryID != nil {
		record.CategoryID = *req.CategoryID
	}
	if req.PaymentMethodID != nil {
		record.PaymentMethodID = *req.PaymentMethodID
	}
	if req.Amount != nil {
		record.Amount = *req.Amount
	}
	if req.Currency != nil && types.IsValidCurrencyType(*req.Currency) {
		record.Currency = *req.Currency
	}
	if req.Description != nil {
		record.Description = req.Description
	}
	if req.Date != nil {
		record.Date = *req.Date
	}

	if err = s.db.WithContext(ctx).Save(&record).Error; err != nil {
		return nil, err
	}

	return record, nil
}

func (s *RecordService) Delete(ctx context.Context, recordID uint) error {
	if err := s.db.WithContext(ctx).Where("id = ?", recordID).Delete(&models.Record{}).Error; err != nil {
		return err
	}
	return nil
}

func (s *RecordService) IsOwner(ctx context.Context, userID uint, recordID uint) (bool, error) {
	var record models.Record
	err := s.db.WithContext(ctx).
		Select("user_id").
		Where("id = ?", recordID).
		First(&record).Error

	if err != nil {
		return false, err
	}

	return record.UserID == userID, nil
}
