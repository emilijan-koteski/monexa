package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"time"

	"github.com/emilijan-koteski/monexa/internal/dtos"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type ExportService struct {
	db             *gorm.DB
	settingService *SettingService
}

func NewExportService(db *gorm.DB, settingService *SettingService) *ExportService {
	return &ExportService{
		db:             db,
		settingService: settingService,
	}
}

var csvHeaders = map[types.LanguageType][]string{
	types.EnglishLanguage:    {"Payment Method", "Category", "Amount", "Currency", "Date", "Description"},
	types.MacedonianLanguage: {"Начин на плаќање", "Категорија", "Износ", "Валута", "Датум", "Опис"},
}

func (s *ExportService) ExportRecordsCSV(ctx context.Context, userID uint, startDate *time.Time, endDate *time.Time) ([]byte, error) {
	setting, err := s.settingService.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user settings: %w", err)
	}

	var rows []dtos.RecordExportRow

	query := s.db.WithContext(ctx).
		Table("records").
		Select("payment_methods.name as payment_method_name, categories.name as category_name, records.amount, records.currency, records.date, records.description").
		Joins("LEFT JOIN categories ON categories.id = records.category_id").
		Joins("LEFT JOIN payment_methods ON payment_methods.id = records.payment_method_id").
		Where("records.user_id = ? AND records.deleted_at IS NULL", userID)

	if startDate != nil {
		query = query.Where("records.date >= ?", *startDate)
	}
	if endDate != nil {
		query = query.Where("records.date <= ?", *endDate)
	}

	query = query.Order("records.date DESC")

	if err := query.Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("failed to query records: %w", err)
	}

	headers, ok := csvHeaders[setting.Language]
	if !ok {
		headers = csvHeaders[types.EnglishLanguage]
	}

	csvRows := make([][]string, 0, len(rows))
	for _, row := range rows {
		description := ""
		if row.Description != nil {
			description = *row.Description
		}

		csvRows = append(csvRows, []string{
			row.PaymentMethodName,
			row.CategoryName,
			fmt.Sprintf("%.2f", row.Amount),
			string(row.Currency),
			row.Date.Format("2006-01-02"),
			description,
		})
	}

	return buildCSV(headers, csvRows)
}

func buildCSV(headers []string, rows [][]string) ([]byte, error) {
	var buf bytes.Buffer

	// UTF-8 BOM for Excel compatibility
	buf.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(&buf)

	if err := writer.Write(headers); err != nil {
		return nil, fmt.Errorf("failed to write CSV headers: %w", err)
	}

	for _, row := range rows {
		if err := writer.Write(row); err != nil {
			return nil, fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("failed to flush CSV writer: %w", err)
	}

	return buf.Bytes(), nil
}
