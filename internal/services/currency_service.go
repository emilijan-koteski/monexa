package services

import (
	"context"
	"fmt"
	"time"

	"github.com/emilijan-koteski/monexa/internal/clients"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type CurrencyService struct {
	db                 *gorm.DB
	exchangeRateClient *clients.ExchangeRateAPIClient
}

func NewCurrencyService(db *gorm.DB, exchangeRateClient *clients.ExchangeRateAPIClient) *CurrencyService {
	return &CurrencyService{
		db:                 db,
		exchangeRateClient: exchangeRateClient,
	}
}

func (s *CurrencyService) FetchAndStoreLatestRates(ctx context.Context) error {
	supportedCurrencies := []types.CurrencyType{types.MacedonianDenar, types.Euro, types.USDollar, types.AustralianDollar, types.SwissFranc, types.BritishPound}
	var errors []error

	for _, baseCurrency := range supportedCurrencies {
		apiRates, err := s.exchangeRateClient.FetchRates(ctx, baseCurrency)
		if err != nil {
			errors = append(errors, fmt.Errorf("failed to fetch rates for %s: %w", baseCurrency, err))
			continue
		}

		tx := s.db.WithContext(ctx).Begin()

		fetchedAt := time.Now()
		for targetCurrency, rate := range apiRates {
			if targetCurrency == baseCurrency {
				continue
			}

			inverseRate := 1.0 / rate

			exchangeRate := models.ExchangeRate{
				FromCurrency: targetCurrency,
				ToCurrency:   baseCurrency,
				Rate:         inverseRate,
				Source:       types.ExchangeRateApi,
				FetchedAt:    fetchedAt,
			}

			if err := tx.Create(&exchangeRate).Error; err != nil {
				tx.Rollback()
				errors = append(errors, fmt.Errorf("failed to store rate %s->%s: %w", targetCurrency, baseCurrency, err))
				break
			}
		}

		if err := tx.Commit().Error; err != nil {
			errors = append(errors, fmt.Errorf("failed to commit rates for %s: %w", baseCurrency, err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("encountered %d errors while fetching rates: %v", len(errors), errors)
	}

	return nil
}

func (s *CurrencyService) getHistoricalRateWithFallback(ctx context.Context, date time.Time, fromCurrency, toCurrency types.CurrencyType) (float64, error) {
	var rate models.ExchangeRate

	err := s.db.WithContext(ctx).
		Where("from_currency = ? AND to_currency = ? AND fetched_at <= ?", fromCurrency, toCurrency, date).
		Order("fetched_at DESC").
		First(&rate).
		Error

	if err == nil {
		return rate.Rate, nil
	}

	if err != gorm.ErrRecordNotFound {
		return 0, fmt.Errorf("failed to fetch historical rate: %w", err)
	}

	err = s.db.WithContext(ctx).
		Where("from_currency = ? AND to_currency = ? AND fetched_at > ?", fromCurrency, toCurrency, date).
		Order("fetched_at ASC").
		First(&rate).
		Error

	if err == nil {
		return rate.Rate, nil
	}

	return 0, fmt.Errorf("failed to fetch exchange rate: %w", err)
}

func (s *CurrencyService) GetHistoricalRatesForRecords(ctx context.Context, records []models.Record, targetCurrency types.CurrencyType) (map[string]float64, error) {
	if len(records) == 0 {
		return make(map[string]float64), nil
	}

	type dateCurrencyPair struct {
		date     string
		currency types.CurrencyType
	}
	uniquePairs := make(map[dateCurrencyPair]bool)

	for _, record := range records {
		if record.Currency != targetCurrency {
			pair := dateCurrencyPair{
				date:     record.Date.Format("2006-01-02"),
				currency: record.Currency,
			}
			uniquePairs[pair] = true
		}
	}

	if len(uniquePairs) == 0 {
		return make(map[string]float64), nil
	}

	ratesMap := make(map[string]float64)

	for pair := range uniquePairs {
		dateTime, err := time.Parse("2006-01-02", pair.date)
		if err != nil {
			return nil, fmt.Errorf("failed to parse date %s: %w", pair.date, err)
		}

		rate, err := s.getHistoricalRateWithFallback(ctx, dateTime, pair.currency, targetCurrency)
		if err != nil {
			return nil, fmt.Errorf("failed to get rate for %s->%s on %s: %w", pair.currency, targetCurrency, pair.date, err)
		}

		rateKey := fmt.Sprintf("%s_%s_%s", pair.date, pair.currency, targetCurrency)
		ratesMap[rateKey] = rate
	}

	return ratesMap, nil
}
