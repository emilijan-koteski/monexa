package services

import (
	"context"
	"errors"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
)

type RecurringExpenseService struct {
	db *gorm.DB
}

func NewRecurringExpenseService(db *gorm.DB) *RecurringExpenseService {
	return &RecurringExpenseService{db: db}
}

func (s *RecurringExpenseService) GetByExample(ctx context.Context, example models.RecurringExpense) (*models.RecurringExpense, error) {
	var recurringExpense models.RecurringExpense
	if err := s.db.WithContext(ctx).
		Where(&example).
		First(&recurringExpense).
		Error; err != nil {
		return nil, err
	}

	return &recurringExpense, nil
}

func (s *RecurringExpenseService) GetAll(ctx context.Context, userID uint) ([]models.RecurringExpense, error) {
	if userID == 0 {
		return []models.RecurringExpense{}, errors.New("invalid user id")
	}

	var recurringExpenses []models.RecurringExpense
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("is_active DESC, next_run_date ASC, id DESC").
		Find(&recurringExpenses).Error; err != nil {
		return nil, err
	}

	return recurringExpenses, nil
}

func (s *RecurringExpenseService) Create(ctx context.Context, req requests.RecurringExpenseRequest) (*models.RecurringExpense, error) {
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}
	if req.CategoryID == nil || *req.CategoryID == 0 {
		return nil, errors.New("invalid category id")
	}
	if req.PaymentMethodID == nil || *req.PaymentMethodID == 0 {
		return nil, errors.New("invalid payment method id")
	}
	if req.Amount == nil || *req.Amount < 0.01 {
		return nil, errors.New("invalid amount")
	}
	if req.Currency == nil || !types.IsValidCurrencyType(*req.Currency) {
		return nil, errors.New("invalid currency")
	}
	if req.Frequency == nil || !types.IsValidFrequencyType(*req.Frequency) {
		return nil, errors.New("invalid frequency")
	}
	if req.StartDate == nil {
		return nil, errors.New("invalid start date")
	}

	startDate := truncateToDate(*req.StartDate)
	if startDate.Before(truncateToDate(time.Now())) {
		return nil, errors.New("start date cannot be in the past")
	}

	recurringExpense := models.RecurringExpense{
		UserID:          *req.UserID,
		CategoryID:      *req.CategoryID,
		PaymentMethodID: *req.PaymentMethodID,
		Amount:          *req.Amount,
		Currency:        *req.Currency,
		Frequency:       *req.Frequency,
		StartDate:       startDate,
		NextRunDate:     startDate,
		IsActive:        true,
	}

	if req.Description != nil && *req.Description != "" {
		recurringExpense.Description = req.Description
	}
	if req.EndDate != nil {
		endDate := truncateToDate(*req.EndDate)
		if endDate.Before(startDate) {
			return nil, errors.New("end date cannot be before start date")
		}
		recurringExpense.EndDate = &endDate
	}
	if req.IsActive != nil {
		recurringExpense.IsActive = *req.IsActive
	}

	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&recurringExpense).Error; err != nil {
			return err
		}
		if recurringExpense.IsActive {
			if _, err := generateDueRecordsTx(tx, &recurringExpense); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return &recurringExpense, nil
}

func (s *RecurringExpenseService) Update(ctx context.Context, req requests.RecurringExpenseRequest) (*models.RecurringExpense, error) {
	if req.ID == nil || *req.ID == 0 {
		return nil, errors.New("invalid recurring expense id")
	}
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}

	recurringExpense, err := s.GetByExample(ctx, models.RecurringExpense{ID: *req.ID})
	if err != nil {
		return nil, err
	}

	wasActive := recurringExpense.IsActive

	if req.CategoryID != nil && *req.CategoryID != 0 {
		recurringExpense.CategoryID = *req.CategoryID
	}
	if req.PaymentMethodID != nil && *req.PaymentMethodID != 0 {
		recurringExpense.PaymentMethodID = *req.PaymentMethodID
	}
	if req.Amount != nil {
		recurringExpense.Amount = *req.Amount
	}
	if req.Currency != nil && types.IsValidCurrencyType(*req.Currency) {
		recurringExpense.Currency = *req.Currency
	}
	if req.Frequency != nil && types.IsValidFrequencyType(*req.Frequency) {
		recurringExpense.Frequency = *req.Frequency
	}
	if req.Description != nil {
		if *req.Description == "" {
			recurringExpense.Description = nil
		} else {
			recurringExpense.Description = req.Description
		}
	}
	if req.IsActive != nil {
		recurringExpense.IsActive = *req.IsActive
	}

	if req.StartDate != nil {
		newStart := truncateToDate(*req.StartDate)
		if !newStart.Equal(recurringExpense.StartDate) {
			if newStart.Before(truncateToDate(time.Now())) {
				return nil, errors.New("start date cannot be in the past")
			}
			recurringExpense.StartDate = newStart
			if recurringExpense.LastGeneratedAt == nil || newStart.After(recurringExpense.NextRunDate) {
				recurringExpense.NextRunDate = newStart
			}
		}
	}

	if recurringExpense.IsActive && !wasActive {
		recurringExpense.NextRunDate = utils.AdvanceToDate(recurringExpense.NextRunDate, recurringExpense.Frequency, recurringExpense.StartDate.Day(), truncateToDate(time.Now()))
	}

	if req.ClearEndDate != nil && *req.ClearEndDate {
		recurringExpense.EndDate = nil
	} else if req.EndDate != nil {
		endDate := truncateToDate(*req.EndDate)
		if endDate.Before(recurringExpense.StartDate) {
			return nil, errors.New("end date cannot be before start date")
		}
		recurringExpense.EndDate = &endDate
	}

	if err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&recurringExpense).Error; err != nil {
			return err
		}
		if recurringExpense.IsActive {
			if _, err := generateDueRecordsTx(tx, recurringExpense); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return recurringExpense, nil
}

func (s *RecurringExpenseService) Delete(ctx context.Context, recurringExpenseID uint) error {
	if err := s.db.WithContext(ctx).Where("id = ?", recurringExpenseID).Delete(&models.RecurringExpense{}).Error; err != nil {
		return err
	}
	return nil
}

func (s *RecurringExpenseService) IsOwner(ctx context.Context, userID uint, recurringExpenseID uint) (bool, error) {
	var recurringExpense models.RecurringExpense
	err := s.db.WithContext(ctx).
		Select("user_id").
		Where("id = ?", recurringExpenseID).
		First(&recurringExpense).Error

	if err != nil {
		return false, err
	}

	return recurringExpense.UserID == userID, nil
}

func (s *RecurringExpenseService) GetDueRecurringExpenses(ctx context.Context) ([]models.RecurringExpense, error) {
	today := truncateToDate(time.Now())

	var due []models.RecurringExpense
	if err := s.db.WithContext(ctx).
		Where("is_active = ? AND next_run_date <= ? AND (end_date IS NULL OR next_run_date <= end_date)", true, today).
		Find(&due).Error; err != nil {
		return nil, err
	}

	return due, nil
}

// GenerateDueRecords re-checks the expense is active inside the transaction before
// materializing its due occurrences, guarding against concurrent changes.
func (s *RecurringExpenseService) GenerateDueRecords(ctx context.Context, recurringExpenseID uint) (int, error) {
	generated := 0

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var recurringExpense models.RecurringExpense
		if err := tx.Where("id = ? AND is_active = ?", recurringExpenseID, true).First(&recurringExpense).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}

		count, err := generateDueRecordsTx(tx, &recurringExpense)
		generated = count
		return err
	})

	if err != nil {
		return 0, err
	}

	return generated, nil
}

// generateDueRecordsTx creates one record per due occurrence of the recurring
// expense, catches up missed occurrences, and advances next_run_date past today.
func generateDueRecordsTx(tx *gorm.DB, recurringExpense *models.RecurringExpense) (int, error) {
	today := truncateToDate(time.Now())
	generated := 0
	anchorDay := recurringExpense.StartDate.Day()
	nextRun := recurringExpense.NextRunDate

	for !nextRun.After(today) {
		if recurringExpense.EndDate != nil && nextRun.After(*recurringExpense.EndDate) {
			break
		}

		record := models.Record{
			UserID:             recurringExpense.UserID,
			CategoryID:         recurringExpense.CategoryID,
			PaymentMethodID:    recurringExpense.PaymentMethodID,
			Amount:             recurringExpense.Amount,
			Currency:           recurringExpense.Currency,
			Description:        recurringExpense.Description,
			Date:               nextRun,
			RecurringExpenseID: &recurringExpense.ID,
		}
		if err := tx.Create(&record).Error; err != nil {
			return generated, err
		}
		generated++

		nextRun = utils.NextOccurrence(nextRun, recurringExpense.Frequency, anchorDay)
	}

	if generated == 0 {
		return 0, nil
	}

	now := time.Now()
	recurringExpense.NextRunDate = nextRun
	recurringExpense.LastGeneratedAt = &now
	updates := map[string]any{"next_run_date": nextRun, "last_generated_at": now}
	if err := tx.Model(&models.RecurringExpense{}).Where("id = ?", recurringExpense.ID).Updates(updates).Error; err != nil {
		return generated, err
	}

	return generated, nil
}

func truncateToDate(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
