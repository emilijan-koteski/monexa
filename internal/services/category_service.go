package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/responses"
	"gorm.io/gorm"
)

type CategoryService struct {
	db              *gorm.DB
	settingService  *SettingService
	currencyService *CurrencyService
}

func NewCategoryService(db *gorm.DB, settingService *SettingService, currencyService *CurrencyService) *CategoryService {
	return &CategoryService{
		db:              db,
		settingService:  settingService,
		currencyService: currencyService,
	}
}

func (s *CategoryService) GetByExample(ctx context.Context, example models.Category) (*models.Category, error) {
	var category models.Category
	if err := s.db.WithContext(ctx).
		Where(&example).
		First(&category).
		Error; err != nil {
		return nil, err
	}

	return &category, nil
}

func (s *CategoryService) GetAllByExample(ctx context.Context, example models.Category) ([]models.Category, error) {
	var categories []models.Category
	if err := s.db.WithContext(ctx).
		Where(&example).
		Find(&categories).
		Error; err != nil {
		return nil, err
	}

	return categories, nil
}

func (s *CategoryService) Create(ctx context.Context, req requests.CategoryRequest) (*models.Category, error) {
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}
	if req.Name == nil || *req.Name == "" {
		return nil, errors.New("invalid name")
	}
	if req.Type == nil || !types.IsValidCategoryType(*req.Type) {
		return nil, errors.New("invalid type")
	}

	category := models.Category{
		UserID: *req.UserID,
		Name:   *req.Name,
		Type:   *req.Type,
	}

	if req.Description != nil && *req.Description != "" {
		category.Description = req.Description
	}

	if req.Color != nil && *req.Color != "" {
		category.Color = req.Color
	}

	if err := s.db.WithContext(ctx).Create(&category).Error; err != nil {
		return nil, err
	}

	return &category, nil
}

func (s *CategoryService) Update(ctx context.Context, req requests.CategoryRequest) (*models.Category, error) {
	if req.ID == nil || *req.ID == 0 {
		return nil, errors.New("invalid category id")
	}
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}

	category, err := s.GetByExample(ctx, models.Category{ID: *req.ID})
	if err != nil {
		return nil, err
	}

	if req.Name != nil && *req.Name != "" {
		category.Name = *req.Name
	}
	if req.Type != nil && types.IsValidCategoryType(*req.Type) {
		category.Type = *req.Type
	}
	if req.Description != nil {
		category.Description = req.Description
	}
	if req.Color != nil {
		category.Color = req.Color
	}

	if err = s.db.WithContext(ctx).Save(&category).Error; err != nil {
		return nil, err
	}

	return category, nil
}

func (s *CategoryService) Delete(ctx context.Context, categoryID uint) error {
	if err := s.db.WithContext(ctx).Where("id = ?", categoryID).Delete(&models.Category{}).Error; err != nil {
		return err
	}
	return nil
}

func (s *CategoryService) IsOwner(ctx context.Context, userID uint, categoryID uint) (bool, error) {
	var category models.Category
	err := s.db.WithContext(ctx).
		Select("user_id").
		Where("id = ?", categoryID).
		First(&category).Error

	if err != nil {
		return false, err
	}

	return category.UserID == userID, nil
}

func (s *CategoryService) GetStatistics(ctx context.Context, req requests.CategoryStatisticsRequest) (*responses.CategoryStatisticsResponse, error) {
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}

	setting, err := s.settingService.GetByUserID(ctx, *req.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user settings: %w", err)
	}
	userCurrency := setting.Currency

	categories, err := s.GetAllByExample(ctx, models.Category{UserID: *req.UserID})
	if err != nil {
		return nil, fmt.Errorf("failed to get categories: %w", err)
	}

	categoryMap := make(map[uint]models.Category, len(categories))
	for _, cat := range categories {
		categoryMap[cat.ID] = cat
	}

	query := s.db.WithContext(ctx).Model(&models.Record{}).Where("user_id = ?", *req.UserID)

	if req.StartDate != nil {
		query = query.Where("date >= ?", *req.StartDate)
	}
	if req.EndDate != nil {
		query = query.Where("date <= ?", *req.EndDate)
	}

	if len(req.PaymentMethodIDs) > 0 {
		query = query.Where("payment_method_id IN ?", req.PaymentMethodIDs)
	}

	var records []models.Record
	if err := query.Find(&records).Error; err != nil {
		return nil, fmt.Errorf("failed to get records: %w", err)
	}

	if len(records) == 0 {
		return &responses.CategoryStatisticsResponse{
			TotalIncome:  0,
			TotalExpense: 0,
			NetBalance:   0,
			Currency:     userCurrency,
			Categories:   []responses.CategoryStatItem{},
		}, nil
	}

	needsConversion := false
	for _, record := range records {
		if record.Currency != userCurrency {
			needsConversion = true
			break
		}
	}

	var exchangeRates map[types.CurrencyType]float64
	if needsConversion {
		exchangeRates, err = s.currencyService.GetRatesForConversion(ctx, userCurrency)
		if err != nil {
			return nil, fmt.Errorf("failed to get exchange rates: %w", err)
		}
	}

	type categoryAggregation struct {
		totalAmount float64
		recordCount int
	}
	aggregations := make(map[uint]*categoryAggregation)

	var totalIncome, totalExpense float64

	for _, record := range records {
		category, exists := categoryMap[record.CategoryID]
		if !exists {
			continue
		}

		if req.Search != nil && *req.Search != "" {
			searchLower := strings.ToLower(*req.Search)
			categoryNameLower := strings.ToLower(category.Name)
			categoryDescLower := ""
			if category.Description != nil {
				categoryDescLower = strings.ToLower(*category.Description)
			}
			amountStr := strconv.FormatFloat(record.Amount, 'f', 2, 64)

			if !strings.Contains(categoryNameLower, searchLower) &&
				!strings.Contains(categoryDescLower, searchLower) &&
				!strings.Contains(amountStr, *req.Search) {
				continue
			}
		}

		convertedAmount := record.Amount
		if record.Currency != userCurrency {
			convertedAmount, err = s.currencyService.ConvertWithRates(record.Amount, record.Currency, userCurrency, exchangeRates)
			if err != nil {
				return nil, fmt.Errorf("currency conversion failed for record %d: %w", record.ID, err)
			}
		}

		if _, exists := aggregations[record.CategoryID]; !exists {
			aggregations[record.CategoryID] = &categoryAggregation{}
		}

		aggregations[record.CategoryID].totalAmount += convertedAmount
		aggregations[record.CategoryID].recordCount++

		if category.Type == types.Income {
			totalIncome += convertedAmount
		} else if category.Type == types.Expense {
			totalExpense += convertedAmount
		}
	}

	categoryStats := make([]responses.CategoryStatItem, 0, len(aggregations))
	for categoryID, agg := range aggregations {
		category := categoryMap[categoryID]
		categoryStats = append(categoryStats, responses.CategoryStatItem{
			CategoryID:   categoryID,
			CategoryName: category.Name,
			CategoryType: category.Type,
			Color:        category.Color,
			RecordCount:  agg.recordCount,
			TotalAmount:  agg.totalAmount,
		})
	}

	sort.Slice(categoryStats, func(i, j int) bool {
		if categoryStats[i].CategoryType != categoryStats[j].CategoryType {
			return categoryStats[i].CategoryType == types.Expense
		}
		return categoryStats[i].TotalAmount > categoryStats[j].TotalAmount
	})

	return &responses.CategoryStatisticsResponse{
		TotalIncome:  totalIncome,
		TotalExpense: totalExpense,
		NetBalance:   totalIncome - totalExpense,
		Currency:     userCurrency,
		Categories:   categoryStats,
	}, nil
}
