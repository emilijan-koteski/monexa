package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/responses"
	"gorm.io/gorm"
)

type RecordService struct {
	db              *gorm.DB
	settingService  *SettingService
	categoryService *CategoryService
	currencyService *CurrencyService
}

func NewRecordService(db *gorm.DB, settingService *SettingService, categoryService *CategoryService, currencyService *CurrencyService) *RecordService {
	return &RecordService{
		db:              db,
		settingService:  settingService,
		categoryService: categoryService,
		currencyService: currencyService,
	}
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

	query := s.db.WithContext(ctx).Where("records.user_id = ?", *filter.UserID)

	if filter.StartDate != nil {
		query = query.Where("records.date >= ?", *filter.StartDate)
	}
	if filter.EndDate != nil {
		query = query.Where("records.date <= ?", *filter.EndDate)
	}

	if filter.CategoryID != nil && *filter.CategoryID != 0 {
		query = query.Where("records.category_id = ?", *filter.CategoryID)
	}

	if len(filter.PaymentMethodIDs) > 0 {
		query = query.Where("records.payment_method_id IN ?", filter.PaymentMethodIDs)
	}

	if filter.Search != nil && *filter.Search != "" {
		searchPattern := "%" + *filter.Search + "%"
		query = query.Select("records.*").
			Joins("LEFT JOIN categories ON categories.id = records.category_id").
			Where("records.description ILIKE ? OR categories.name ILIKE ?", searchPattern, searchPattern)
	}

	sortBy := "records.date"
	sortOrder := "DESC"
	if filter.SortBy != nil && (*filter.SortBy == "date" || *filter.SortBy == "amount") {
		sortBy = "records." + *filter.SortBy
	}
	if filter.SortOrder != nil && (*filter.SortOrder == "asc" || *filter.SortOrder == "desc") {
		sortOrder = strings.ToUpper(*filter.SortOrder)
	}
	query = query.Order(fmt.Sprintf("%s %s, records.id DESC", sortBy, sortOrder))

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

func (s *RecordService) GetSummary(ctx context.Context, filter requests.RecordFilterRequest) (*responses.RecordSummaryResponse, error) {
	if filter.UserID == nil || *filter.UserID == 0 {
		return nil, errors.New("invalid user id")
	}

	setting, err := s.settingService.GetByUserID(ctx, *filter.UserID)
	if err != nil {
		return nil, err
	}
	userCurrency := setting.Currency

	records, err := s.GetAll(ctx, filter)
	if err != nil {
		return nil, err
	}

	if len(records) == 0 {
		return &responses.RecordSummaryResponse{
			Amount:   0,
			Currency: userCurrency,
		}, nil
	}

	needsConversion := false
	for _, record := range records {
		if record.Currency != userCurrency {
			needsConversion = true
			break
		}
	}

	var historicalRates map[string]float64
	if needsConversion {
		historicalRates, err = s.currencyService.GetHistoricalRatesForRecords(ctx, records, userCurrency)
		if err != nil {
			return nil, fmt.Errorf("failed to get historical exchange rates: %w", err)
		}
	}

	categories, err := s.categoryService.GetAllByExample(ctx, models.Category{UserID: *filter.UserID})
	if err != nil {
		return nil, err
	}

	categoryTypeMap := make(map[uint]types.CategoryType, len(categories))
	for _, category := range categories {
		categoryTypeMap[category.ID] = category.Type
	}

	var totalAmount float64
	for _, record := range records {
		categoryType, exists := categoryTypeMap[record.CategoryID]
		if !exists {
			continue
		}

		var convertedAmount float64
		if record.Currency != userCurrency {
			rateKey := fmt.Sprintf("%s_%s_%s",
				record.Date.Format("2006-01-02"),
				record.Currency,
				userCurrency)

			rate, exists := historicalRates[rateKey]
			if !exists {
				return nil, fmt.Errorf("no rate found for record #%d (%s->%s on %s)", record.ID, record.Currency, userCurrency, record.Date.Format("2006-01-02"))
			}

			convertedAmount = record.Amount * rate
		} else {
			convertedAmount = record.Amount
		}

		if categoryType == types.Income {
			totalAmount += convertedAmount
		} else if categoryType == types.Expense {
			totalAmount -= convertedAmount
		}
	}

	return &responses.RecordSummaryResponse{
		Amount:   totalAmount,
		Currency: userCurrency,
	}, nil
}

func (s *RecordService) GetDescriptionSuggestions(ctx context.Context, userID uint, categoryID uint) ([]string, error) {
	if userID == 0 || categoryID == 0 {
		return []string{}, nil
	}

	var records []models.Record
	if err := s.db.WithContext(ctx).
		Select("description").
		Where("user_id = ? AND category_id = ? AND description IS NOT NULL AND description != ''", userID, categoryID).
		Order("date DESC, created_at DESC").
		Limit(20).
		Find(&records).Error; err != nil {
		return nil, err
	}

	var suggestions []string
	seen := make(map[string]bool)
	for _, r := range records {
		if r.Description != nil && *r.Description != "" && !seen[*r.Description] {
			seen[*r.Description] = true
			suggestions = append(suggestions, *r.Description)
			if len(suggestions) == 4 {
				break
			}
		}
	}

	if suggestions == nil {
		suggestions = []string{}
	}

	return suggestions, nil
}
