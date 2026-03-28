package services

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/emilijan-koteski/monexa/internal/dtos"
	dtotypes "github.com/emilijan-koteski/monexa/internal/dtos/types"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"gorm.io/gorm"
)

type ExportService struct {
	db                     *gorm.DB
	settingService         *SettingService
	legalComplianceEnabled bool
}

func NewExportService(db *gorm.DB, settingService *SettingService, legalComplianceEnabled bool) *ExportService {
	return &ExportService{
		db:                     db,
		settingService:         settingService,
		legalComplianceEnabled: legalComplianceEnabled,
	}
}

var recordCSVHeaders = map[types.LanguageType][]string{
	types.EnglishLanguage:    {"Payment Method", "Category", "Amount", "Currency", "Date", "Description"},
	types.MacedonianLanguage: {"Начин на плаќање", "Категорија", "Износ", "Валута", "Датум", "Опис"},
}

var profileCSVHeaders = map[types.LanguageType][]string{
	types.EnglishLanguage:    {"Name", "Email", "Created At"},
	types.MacedonianLanguage: {"Име", "Е-пошта", "Датум на креирање"},
}

var categoryCSVHeaders = map[types.LanguageType][]string{
	types.EnglishLanguage:    {"Name", "Type", "Description"},
	types.MacedonianLanguage: {"Име", "Тип", "Опис"},
}

var paymentMethodCSVHeaders = map[types.LanguageType][]string{
	types.EnglishLanguage:    {"Name"},
	types.MacedonianLanguage: {"Име"},
}

var preferencesCSVHeaders = map[types.LanguageType][]string{
	types.EnglishLanguage:    {"Language", "Currency"},
	types.MacedonianLanguage: {"Јазик", "Валута"},
}

var consentCSVHeaders = map[types.LanguageType][]string{
	types.EnglishLanguage:    {"Document", "Version", "Accepted At", "IP Address", "User Agent"},
	types.MacedonianLanguage: {"Документ", "Верзија", "Прифатено на", "IP адреса", "User Agent"},
}

func (s *ExportService) ExportData(ctx context.Context, req requests.ExportRequest) ([]byte, error) {
	setting, err := s.settingService.GetByUserID(ctx, req.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user settings: %w", err)
	}

	lang := setting.Language
	if !types.IsValidLanguageType(lang) {
		lang = types.EnglishLanguage
	}

	categories := req.Categories
	if len(categories) == 0 {
		categories = dtotypes.AllExportCategories
	}

	categorySet := make(map[dtotypes.ExportCategoryType]bool, len(categories))
	for _, c := range categories {
		categorySet[c] = true
	}

	if !s.legalComplianceEnabled {
		delete(categorySet, dtotypes.ExportCategoryConsent)
	}

	ext := strings.ToLower(string(req.Format))
	files := make(map[string][]byte)

	if categorySet[dtotypes.ExportCategoryProfile] {
		data, err := s.exportProfile(ctx, req.UserID, req.Format, lang)
		if err != nil {
			return nil, fmt.Errorf("failed to export profile: %w", err)
		}
		if data != nil {
			files["profile/profile."+ext] = data
		}
	}

	if categorySet[dtotypes.ExportCategoryRecords] {
		data, err := s.exportRecords(ctx, req.UserID, req.StartDate, req.EndDate, req.Format, lang)
		if err != nil {
			return nil, fmt.Errorf("failed to export records: %w", err)
		}
		if data != nil {
			files["records/records."+ext] = data
		}
	}

	if categorySet[dtotypes.ExportCategoryCategories] {
		data, err := s.exportCategories(ctx, req.UserID, req.Format, lang)
		if err != nil {
			return nil, fmt.Errorf("failed to export categories: %w", err)
		}
		if data != nil {
			files["categories/categories."+ext] = data
		}
	}

	if categorySet[dtotypes.ExportCategoryPaymentMethods] {
		data, err := s.exportPaymentMethods(ctx, req.UserID, req.Format, lang)
		if err != nil {
			return nil, fmt.Errorf("failed to export payment methods: %w", err)
		}
		if data != nil {
			files["payment-methods/payment-methods."+ext] = data
		}
	}

	if categorySet[dtotypes.ExportCategoryPreferences] {
		data, err := s.exportPreferences(ctx, req.UserID, req.Format, lang)
		if err != nil {
			return nil, fmt.Errorf("failed to export preferences: %w", err)
		}
		if data != nil {
			files["preferences/preferences."+ext] = data
		}
	}

	if categorySet[dtotypes.ExportCategoryConsent] {
		data, err := s.exportConsent(ctx, req.UserID, req.Format, lang)
		if err != nil {
			return nil, fmt.Errorf("failed to export consent history: %w", err)
		}
		if data != nil {
			files["consent-history/consent-history."+ext] = data
		}
	}

	return buildZIP(files)
}

func (s *ExportService) exportProfile(ctx context.Context, userID uint, format dtotypes.ExportFormatType, lang types.LanguageType) ([]byte, error) {
	var row dtos.ProfileExportRow

	err := s.db.WithContext(ctx).
		Table("users").
		Select("name, email, created_at").
		Where("id = ? AND deleted_at IS NULL", userID).
		Scan(&row).Error
	if err != nil {
		return nil, err
	}

	if row.Name == "" && row.Email == "" {
		return nil, nil
	}

	if format == dtotypes.ExportFormatJSON {
		return buildJSON(row)
	}

	headers := getHeaders(profileCSVHeaders, lang)
	rows := [][]string{{
		row.Name,
		row.Email,
		row.CreatedAt.Format("2006-01-02"),
	}}
	return buildCSV(headers, rows)
}

func (s *ExportService) exportRecords(ctx context.Context, userID uint, startDate *time.Time, endDate *time.Time, format dtotypes.ExportFormatType, lang types.LanguageType) ([]byte, error) {
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
		return nil, err
	}

	if len(rows) == 0 {
		return nil, nil
	}

	if format == dtotypes.ExportFormatJSON {
		return buildJSON(rows)
	}

	headers := getHeaders(recordCSVHeaders, lang)
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

func (s *ExportService) exportCategories(ctx context.Context, userID uint, format dtotypes.ExportFormatType, lang types.LanguageType) ([]byte, error) {
	var rows []dtos.CategoryExportRow

	err := s.db.WithContext(ctx).
		Table("categories").
		Select("name, type, COALESCE(description, '') as description").
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, nil
	}

	for i := range rows {
		switch rows[i].Type {
		case "EXPENSE":
			rows[i].Type = "Expense"
		case "INCOME":
			rows[i].Type = "Income"
		}
	}

	if format == dtotypes.ExportFormatJSON {
		return buildJSON(rows)
	}

	headers := getHeaders(categoryCSVHeaders, lang)
	csvRows := make([][]string, 0, len(rows))
	for _, row := range rows {
		csvRows = append(csvRows, []string{
			row.Name,
			row.Type,
			row.Description,
		})
	}
	return buildCSV(headers, csvRows)
}

func (s *ExportService) exportPaymentMethods(ctx context.Context, userID uint, format dtotypes.ExportFormatType, lang types.LanguageType) ([]byte, error) {
	var rows []dtos.PaymentMethodExportRow

	err := s.db.WithContext(ctx).
		Table("payment_methods").
		Select("name").
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, nil
	}

	if format == dtotypes.ExportFormatJSON {
		return buildJSON(rows)
	}

	headers := getHeaders(paymentMethodCSVHeaders, lang)
	csvRows := make([][]string, 0, len(rows))
	for _, row := range rows {
		csvRows = append(csvRows, []string{row.Name})
	}
	return buildCSV(headers, csvRows)
}

func (s *ExportService) exportPreferences(ctx context.Context, userID uint, format dtotypes.ExportFormatType, lang types.LanguageType) ([]byte, error) {
	setting, err := s.settingService.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if setting == nil {
		return nil, nil
	}

	row := dtos.PreferencesExportRow{
		Language: string(setting.Language),
		Currency: string(setting.Currency),
	}

	if format == dtotypes.ExportFormatJSON {
		return buildJSON(row)
	}

	headers := getHeaders(preferencesCSVHeaders, lang)
	csvRows := [][]string{{row.Language, row.Currency}}
	return buildCSV(headers, csvRows)
}

func (s *ExportService) exportConsent(ctx context.Context, userID uint, format dtotypes.ExportFormatType, lang types.LanguageType) ([]byte, error) {
	titleColumn := "ld.title"
	if lang == types.MacedonianLanguage {
		titleColumn = "ld.title_mk"
	}

	var rows []dtos.ConsentExportRow

	err := s.db.WithContext(ctx).
		Table("user_legal_acceptances ula").
		Select(fmt.Sprintf("%s as document, ld.version, ula.accepted_at, COALESCE(ula.ip_address, '') as ip_address, COALESCE(ula.user_agent, '') as user_agent", titleColumn)).
		Joins("JOIN legal_documents ld ON ld.id = ula.legal_document_id").
		Where("ula.user_id = ? AND ula.deleted_at IS NULL", userID).
		Order("ula.accepted_at DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, nil
	}

	if format == dtotypes.ExportFormatJSON {
		return buildJSON(rows)
	}

	headers := getHeaders(consentCSVHeaders, lang)
	csvRows := make([][]string, 0, len(rows))
	for _, row := range rows {
		csvRows = append(csvRows, []string{
			row.Document,
			fmt.Sprintf("%d", row.Version),
			row.AcceptedAt.Format("2006-01-02 15:04:05"),
			row.IPAddress,
			row.UserAgent,
		})
	}
	return buildCSV(headers, csvRows)
}

func getHeaders(headerMap map[types.LanguageType][]string, lang types.LanguageType) []string {
	headers, ok := headerMap[lang]
	if !ok {
		headers = headerMap[types.EnglishLanguage]
	}
	return headers
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

func buildJSON(data any) ([]byte, error) {
	return json.MarshalIndent(data, "", "  ")
}

func buildZIP(files map[string][]byte) ([]byte, error) {
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)

	for path, content := range files {
		f, err := w.Create(path)
		if err != nil {
			return nil, fmt.Errorf("failed to create zip entry %s: %w", path, err)
		}
		if _, err := f.Write(content); err != nil {
			return nil, fmt.Errorf("failed to write zip entry %s: %w", path, err)
		}
	}

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("failed to close zip writer: %w", err)
	}

	return buf.Bytes(), nil
}
