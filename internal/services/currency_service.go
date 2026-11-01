package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/emilijan-koteski/monexa/internal/clients"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

var ErrRateUnavailable = errors.New("exchange rate unavailable")

// RateQuote is a conversion rate together with where it came from and when it was fetched.
type RateQuote struct {
	Rate      float64                      `json:"rate"`
	Source    types.ExchangeRateSourceType `json:"source"`
	FetchedAt *time.Time                   `json:"fetchedAt"`
}

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
	var errs []error

	for _, baseCurrency := range types.SupportedCurrencies() {
		apiRates, err := s.exchangeRateClient.FetchRates(ctx, baseCurrency)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to fetch rates for %s: %w", baseCurrency, err))
			continue
		}

		if err := s.storeRatesForBase(ctx, baseCurrency, apiRates); err != nil {
			errs = append(errs, err)
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("encountered %d errors while fetching rates: %v", len(errs), errs)
	}

	return nil
}

func (s *CurrencyService) storeRatesForBase(ctx context.Context, baseCurrency types.CurrencyType, apiRates map[types.CurrencyType]float64) error {
	fetchedAt := time.Now()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for targetCurrency, rate := range apiRates {
			if targetCurrency == baseCurrency || rate == 0 {
				continue
			}

			exchangeRate := models.ExchangeRate{
				FromCurrency: targetCurrency,
				ToCurrency:   baseCurrency,
				Rate:         1.0 / rate,
				Source:       types.ExchangeRateApi,
				FetchedAt:    fetchedAt,
			}

			if err := tx.Create(&exchangeRate).Error; err != nil {
				return fmt.Errorf("failed to store rate %s->%s: %w", targetCurrency, baseCurrency, err)
			}
		}
		return nil
	})
}

// GetRate returns the rate for converting from one currency to another on a date, going through EUR when no direct pair is stored.
func (s *CurrencyService) GetRate(ctx context.Context, date time.Time, fromCurrency, toCurrency types.CurrencyType) (RateQuote, error) {
	if fromCurrency == toCurrency {
		return RateQuote{Rate: 1, Source: types.Identity}, nil
	}

	direct, err := s.findHistoricalRate(ctx, date, fromCurrency, toCurrency)
	if err == nil {
		return RateQuote{Rate: direct.Rate, Source: direct.Source, FetchedAt: &direct.FetchedAt}, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return RateQuote{}, err
	}

	if fromCurrency == types.Euro || toCurrency == types.Euro {
		return RateQuote{}, ErrRateUnavailable
	}
	toEuro, err := s.findHistoricalRate(ctx, date, fromCurrency, types.Euro)
	if err != nil {
		return RateQuote{}, rateLookupError(err)
	}
	fromEuro, err := s.findHistoricalRate(ctx, date, types.Euro, toCurrency)
	if err != nil {
		return RateQuote{}, rateLookupError(err)
	}

	source := types.ExchangeRateApi
	if toEuro.Source == types.Fallback || fromEuro.Source == types.Fallback {
		source = types.Fallback
	}
	fetchedAt := toEuro.FetchedAt
	if fromEuro.FetchedAt.Before(fetchedAt) {
		fetchedAt = fromEuro.FetchedAt
	}
	return RateQuote{Rate: toEuro.Rate * fromEuro.Rate, Source: source, FetchedAt: &fetchedAt}, nil
}

func rateLookupError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrRateUnavailable
	}
	return err
}

func (s *CurrencyService) findHistoricalRate(ctx context.Context, date time.Time, fromCurrency, toCurrency types.CurrencyType) (*models.ExchangeRate, error) {
	var rate models.ExchangeRate

	err := s.db.WithContext(ctx).
		Where("from_currency = ? AND to_currency = ? AND fetched_at <= ?", fromCurrency, toCurrency, date).
		Order("fetched_at DESC").
		First(&rate).
		Error
	if err == nil {
		return &rate, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to fetch historical rate: %w", err)
	}

	err = s.db.WithContext(ctx).
		Where("from_currency = ? AND to_currency = ? AND fetched_at > ?", fromCurrency, toCurrency, date).
		Order("fetched_at ASC").
		First(&rate).
		Error
	if err != nil {
		return nil, err
	}
	return &rate, nil
}

func (s *CurrencyService) getHistoricalRateWithFallback(ctx context.Context, date time.Time, fromCurrency, toCurrency types.CurrencyType) (float64, error) {
	quote, err := s.GetRate(ctx, date, fromCurrency, toCurrency)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch exchange rate: %w", err)
	}
	return quote.Rate, nil
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
