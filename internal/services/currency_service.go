package services

import (
	"context"
	"fmt"

	"github.com/emilijan-koteski/monexa/internal/clients"
	"github.com/emilijan-koteski/monexa/internal/models/types"
)

// TODO (Emilijan): Database-Backend Exchange Rates
//
// 1. Move fallback exchange rates from const variables to a database table with timestamps
//
// 2. Implement a daily scheduler that calls the Exchange Rate API once per day for all implemented
//    currencies and stores the results in the database. Update GetRatesForConversion() to fetch
//    rates from the database instead of calling the API directly.
//
// 3. (Optional) Add historical exchange rate calculation functionality using the timestamped
//    database records for accurate past conversions.

type CurrencyService struct {
	exchangeRateClient    *clients.ExchangeRateAPIClient
	fallbackExchangeRates map[string]float64
}

func NewCurrencyService(exchangeRateClient *clients.ExchangeRateAPIClient) *CurrencyService {
	return &CurrencyService{
		exchangeRateClient:    exchangeRateClient,
		fallbackExchangeRates: initializeFallbackExchangeRates(),
	}
}

func initializeFallbackExchangeRates() map[string]float64 {
	return map[string]float64{
		"EUR_MKD": 61.55,
		"MKD_EUR": 0.016,
		"MKD_USD": 0.019,
		"EUR_USD": 1.17,
		"USD_EUR": 0.85,
		"USD_MKD": 52.40,
	}
}

func (s *CurrencyService) GetRatesForConversion(ctx context.Context, targetCurrency types.CurrencyType) (map[types.CurrencyType]float64, error) {
	apiRates, err := s.exchangeRateClient.FetchRates(ctx, targetCurrency)
	if err != nil {
		return s.buildFallbackConversionRates(targetCurrency)
	}

	conversionRates := make(map[types.CurrencyType]float64)
	conversionRates[targetCurrency] = 1.0

	for currency, rate := range apiRates {
		if currency != targetCurrency {
			conversionRates[currency] = 1.0 / rate
		}
	}

	return conversionRates, nil
}

func (s *CurrencyService) buildFallbackConversionRates(targetCurrency types.CurrencyType) (map[types.CurrencyType]float64, error) {
	fallbackMap := make(map[types.CurrencyType]float64)
	fallbackMap[targetCurrency] = 1.0

	for _, sourceCurrency := range []types.CurrencyType{types.MacedonianDenar, types.Euro, types.USDollar} {
		if sourceCurrency == targetCurrency {
			continue
		}

		rate, err := s.getFallbackRate(sourceCurrency, targetCurrency)
		if err != nil {
			return nil, fmt.Errorf("no fallback rate available for %s to %s: %w", sourceCurrency, targetCurrency, err)
		}
		fallbackMap[sourceCurrency] = rate
	}

	return fallbackMap, nil
}

func (s *CurrencyService) ConvertWithRates(amount float64, fromCurrency, toCurrency types.CurrencyType, rates map[types.CurrencyType]float64) (float64, error) {
	if fromCurrency == toCurrency {
		return amount, nil
	}

	rate, exists := rates[fromCurrency]
	if !exists {
		return 0, fmt.Errorf("no conversion rate found for %s to %s", fromCurrency, toCurrency)
	}

	return amount * rate, nil
}

func (s *CurrencyService) getFallbackRate(fromCurrency, toCurrency types.CurrencyType) (float64, error) {
	key := fmt.Sprintf("%s_%s", fromCurrency, toCurrency)

	if rate, exists := s.fallbackExchangeRates[key]; exists {
		return rate, nil
	}

	inverseKey := fmt.Sprintf("%s_%s", toCurrency, fromCurrency)
	if inverseRate, exists := s.fallbackExchangeRates[inverseKey]; exists {
		return 1.0 / inverseRate, nil
	}

	return 0, fmt.Errorf("no fallback rate available for %s to %s", fromCurrency, toCurrency)
}
