package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/responses"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
)

const defaultColor = "#6669ff"

type TrendReportService struct {
	db              *gorm.DB
	settingService  *SettingService
	currencyService *CurrencyService
}

func NewTrendReportService(db *gorm.DB, settingService *SettingService, currencyService *CurrencyService) *TrendReportService {
	return &TrendReportService{
		db:              db,
		settingService:  settingService,
		currencyService: currencyService,
	}
}

func (s *TrendReportService) GetAll(ctx context.Context, userID uint) ([]models.TrendReport, error) {
	var reports []models.TrendReport
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Preload("Categories").
		Find(&reports).Error; err != nil {
		return nil, err
	}
	return reports, nil
}

func (s *TrendReportService) GetByID(ctx context.Context, reportID uint) (*models.TrendReport, error) {
	var report models.TrendReport
	if err := s.db.WithContext(ctx).
		Where("id = ?", reportID).
		Preload("Categories").
		First(&report).Error; err != nil {
		return nil, err
	}
	return &report, nil
}

func (s *TrendReportService) Create(ctx context.Context, req requests.TrendReportRequest) (*models.TrendReport, error) {
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}
	if len(req.CategoryIDs) == 0 {
		return nil, errors.New("at least one category is required")
	}

	categories, err := s.loadCategories(ctx, req.CategoryIDs)
	if err != nil {
		return nil, err
	}

	color := resolveColor(req.Color, categories)

	report := models.TrendReport{
		UserID:      *req.UserID,
		Title:       utils.NilIfEmpty(req.Title),
		Description: utils.NilIfEmpty(req.Description),
		Color:       &color,
		Categories:  categories,
	}

	if err := s.db.WithContext(ctx).Create(&report).Error; err != nil {
		return nil, fmt.Errorf("failed to create trend report: %w", err)
	}

	return &report, nil
}

func (s *TrendReportService) Update(ctx context.Context, req requests.TrendReportRequest) (*models.TrendReport, error) {
	if req.ID == nil || *req.ID == 0 {
		return nil, errors.New("invalid report id")
	}
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}
	if len(req.CategoryIDs) == 0 {
		return nil, errors.New("at least one category is required")
	}

	report, err := s.GetByID(ctx, *req.ID)
	if err != nil {
		return nil, err
	}

	categories, err := s.loadCategories(ctx, req.CategoryIDs)
	if err != nil {
		return nil, err
	}

	color := resolveColor(req.Color, categories)

	report.Title = utils.NilIfEmpty(req.Title)
	report.Description = utils.NilIfEmpty(req.Description)
	report.Color = &color

	tx := s.db.WithContext(ctx).Begin()

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Save(report).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update trend report: %w", err)
	}

	if err := tx.Model(report).Association("Categories").Replace(categories); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update categories: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit update: %w", err)
	}

	report.Categories = categories
	return report, nil
}

func (s *TrendReportService) Delete(ctx context.Context, reportID uint) error {
	if err := s.db.WithContext(ctx).Where("id = ?", reportID).Delete(&models.TrendReport{}).Error; err != nil {
		return fmt.Errorf("failed to delete trend report: %w", err)
	}
	return nil
}

func (s *TrendReportService) IsOwner(ctx context.Context, userID uint, reportID uint) (bool, error) {
	var report models.TrendReport
	if err := s.db.WithContext(ctx).
		Select("user_id").
		Where("id = ?", reportID).
		First(&report).Error; err != nil {
		return false, err
	}
	return report.UserID == userID, nil
}

func (s *TrendReportService) GetMonthlyData(ctx context.Context, req requests.TrendReportMonthlyDataRequest) (*responses.TrendReportMonthlyDataResponse, error) {
	if req.Year <= 0 {
		return nil, errors.New("invalid year")
	}

	setting, err := s.settingService.GetByUserID(ctx, req.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user settings: %w", err)
	}
	userCurrency := setting.Currency

	report, err := s.GetByID(ctx, req.ReportID)
	if err != nil {
		return nil, err
	}

	if len(report.Categories) == 0 {
		return emptyMonthlyData(userCurrency, req.Year), nil
	}

	categoryIDs := make([]uint, 0, len(report.Categories))
	categoryTypeMap := make(map[uint]types.CategoryType, len(report.Categories))
	hasIncome := false
	hasExpense := false

	for _, cat := range report.Categories {
		if req.Type != nil && cat.Type != *req.Type {
			continue
		}
		categoryIDs = append(categoryIDs, cat.ID)
		categoryTypeMap[cat.ID] = cat.Type
		if cat.Type == types.Income {
			hasIncome = true
		} else {
			hasExpense = true
		}
	}

	if len(categoryIDs) == 0 {
		return emptyMonthlyData(userCurrency, req.Year), nil
	}

	startDate := time.Date(req.Year, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(req.Year+1, 1, 1, 0, 0, 0, 0, time.UTC)

	var records []models.Record
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND category_id IN ? AND date >= ? AND date < ?", req.UserID, categoryIDs, startDate, endDate).
		Find(&records).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch records: %w", err)
	}

	if len(records) == 0 {
		return emptyMonthlyData(userCurrency, req.Year), nil
	}

	var historicalRates map[string]float64
	for _, record := range records {
		if record.Currency != userCurrency {
			historicalRates, err = s.currencyService.GetHistoricalRatesForRecords(ctx, records, userCurrency)
			if err != nil {
				return nil, fmt.Errorf("failed to get historical exchange rates: %w", err)
			}
			break
		}
	}

	monthIncome := make(map[int]float64)
	monthExpense := make(map[int]float64)

	for _, record := range records {
		var convertedAmount float64
		if record.Currency != userCurrency {
			rateKey := fmt.Sprintf("%s_%s_%s",
				record.Date.Format("2006-01-02"),
				record.Currency,
				userCurrency)
			rate, exists := historicalRates[rateKey]
			if !exists {
				return nil, fmt.Errorf("no rate found for record #%d on %s", record.ID, record.Date.Format("2006-01-02"))
			}
			convertedAmount = record.Amount * rate
		} else {
			convertedAmount = record.Amount
		}

		month := int(record.Date.Month())
		catType := categoryTypeMap[record.CategoryID]
		if catType == types.Income {
			monthIncome[month] += convertedAmount
		} else {
			monthExpense[month] += convertedAmount
		}
	}

	data := make([]responses.MonthlyDataPoint, 12)
	for i := 1; i <= 12; i++ {
		income := monthIncome[i]
		expense := monthExpense[i]

		var amount float64
		switch {
		case hasIncome && hasExpense:
			amount = income - expense
		case hasIncome:
			amount = income
		default:
			amount = expense
		}

		data[i-1] = responses.MonthlyDataPoint{Month: i, Amount: amount}
	}

	return &responses.TrendReportMonthlyDataResponse{
		Data:     data,
		Currency: userCurrency,
		Year:     req.Year,
	}, nil
}

func (s *TrendReportService) GetMonthlyDetails(ctx context.Context, req requests.TrendReportMonthlyDataRequest) (*responses.TrendReportMonthlyDetailsResponse, error) {
	if req.Year <= 0 {
		return nil, errors.New("invalid year")
	}

	setting, err := s.settingService.GetByUserID(ctx, req.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user settings: %w", err)
	}
	userCurrency := setting.Currency

	report, err := s.GetByID(ctx, req.ReportID)
	if err != nil {
		return nil, err
	}

	if len(report.Categories) == 0 {
		return emptyMonthlyDetails(userCurrency, req.Year), nil
	}

	categoryIDs := make([]uint, 0, len(report.Categories))
	categoryNameMap := make(map[uint]string, len(report.Categories))

	for _, cat := range report.Categories {
		if req.Type != nil && cat.Type != *req.Type {
			continue
		}
		categoryIDs = append(categoryIDs, cat.ID)
		categoryNameMap[cat.ID] = cat.Name
	}

	if len(categoryIDs) == 0 {
		return emptyMonthlyDetails(userCurrency, req.Year), nil
	}

	startDate := time.Date(req.Year, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(req.Year+1, 1, 1, 0, 0, 0, 0, time.UTC)

	var records []models.Record
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND category_id IN ? AND date >= ? AND date < ?", req.UserID, categoryIDs, startDate, endDate).
		Find(&records).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch records: %w", err)
	}

	if len(records) == 0 {
		return emptyMonthlyDetails(userCurrency, req.Year), nil
	}

	var historicalRates map[string]float64
	for _, record := range records {
		if record.Currency != userCurrency {
			historicalRates, err = s.currencyService.GetHistoricalRatesForRecords(ctx, records, userCurrency)
			if err != nil {
				return nil, fmt.Errorf("failed to get historical exchange rates: %w", err)
			}
			break
		}
	}

	type groupKey struct {
		Month      int
		CategoryID uint
		Desc       string
	}
	groupAmounts := make(map[groupKey]float64)

	for _, record := range records {
		var convertedAmount float64
		if record.Currency != userCurrency {
			rateKey := fmt.Sprintf("%s_%s_%s",
				record.Date.Format("2006-01-02"),
				record.Currency,
				userCurrency)
			rate, exists := historicalRates[rateKey]
			if !exists {
				return nil, fmt.Errorf("no rate found for record #%d on %s", record.ID, record.Date.Format("2006-01-02"))
			}
			convertedAmount = record.Amount * rate
		} else {
			convertedAmount = record.Amount
		}

		desc := ""
		if record.Description != nil {
			desc = strings.TrimSpace(*record.Description)
		}

		key := groupKey{
			Month:      int(record.Date.Month()),
			CategoryID: record.CategoryID,
			Desc:       desc,
		}
		groupAmounts[key] += convertedAmount
	}

	monthItems := make(map[int][]responses.MonthlyDetailItem)
	for key, amount := range groupAmounts {
		isUngrouped := key.Desc == ""
		label := key.Desc
		item := responses.MonthlyDetailItem{
			Label:        label,
			CategoryName: categoryNameMap[key.CategoryID],
			CategoryID:   key.CategoryID,
			Amount:       amount,
			IsUngrouped:  isUngrouped,
		}
		monthItems[key.Month] = append(monthItems[key.Month], item)
	}

	for month := range monthItems {
		sort.Slice(monthItems[month], func(i, j int) bool {
			return monthItems[month][i].Amount > monthItems[month][j].Amount
		})
	}

	data := make([]responses.MonthlyDetailGroup, 12)
	for i := 1; i <= 12; i++ {
		items := monthItems[i]
		if items == nil {
			items = []responses.MonthlyDetailItem{}
		}
		data[i-1] = responses.MonthlyDetailGroup{Month: i, Items: items}
	}

	return &responses.TrendReportMonthlyDetailsResponse{
		Data:     data,
		Currency: userCurrency,
		Year:     req.Year,
	}, nil
}

func (s *TrendReportService) loadCategories(ctx context.Context, categoryIDs []uint) ([]models.Category, error) {
	var categories []models.Category
	if err := s.db.WithContext(ctx).
		Where("id IN ?", categoryIDs).
		Find(&categories).Error; err != nil {
		return nil, fmt.Errorf("failed to load categories: %w", err)
	}
	if len(categories) == 0 {
		return nil, errors.New("no valid categories found")
	}
	return categories, nil
}

func resolveColor(reqColor *string, categories []models.Category) string {
	if reqColor != nil && *reqColor != "" {
		return *reqColor
	}
	if len(categories) > 0 && categories[0].Color != nil && *categories[0].Color != "" {
		return *categories[0].Color
	}
	return defaultColor
}

func emptyMonthlyDetails(currency types.CurrencyType, year int) *responses.TrendReportMonthlyDetailsResponse {
	data := make([]responses.MonthlyDetailGroup, 12)
	for i := 1; i <= 12; i++ {
		data[i-1] = responses.MonthlyDetailGroup{Month: i, Items: []responses.MonthlyDetailItem{}}
	}
	return &responses.TrendReportMonthlyDetailsResponse{
		Data:     data,
		Currency: currency,
		Year:     year,
	}
}

func emptyMonthlyData(currency types.CurrencyType, year int) *responses.TrendReportMonthlyDataResponse {
	data := make([]responses.MonthlyDataPoint, 12)
	for i := 1; i <= 12; i++ {
		data[i-1] = responses.MonthlyDataPoint{Month: i, Amount: 0}
	}
	return &responses.TrendReportMonthlyDataResponse{
		Data:     data,
		Currency: currency,
		Year:     year,
	}
}
