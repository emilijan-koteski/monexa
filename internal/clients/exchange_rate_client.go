package clients

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/responses"
)

type ExchangeRateAPIClient struct {
	apiKey     string
	httpClient *http.Client
	baseURL    string
}

func NewExchangeRateAPIClient() *ExchangeRateAPIClient {
	return &ExchangeRateAPIClient{
		apiKey:     os.Getenv("EXCHANGE_RATE_API_KEY"),
		httpClient: &http.Client{Timeout: 10 * time.Second},
		baseURL:    "https://v6.exchangerate-api.com/v6",
	}
}

func (c *ExchangeRateAPIClient) FetchRates(ctx context.Context, baseCurrency types.CurrencyType) (map[types.CurrencyType]float64, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("API key not configured")
	}

	url := fmt.Sprintf("%s/%s/latest/%s", c.baseURL, c.apiKey, baseCurrency)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var apiResp responses.ExchangeRateAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode API response: %w", err)
	}

	if apiResp.Result != "success" {
		return nil, fmt.Errorf("API returned unsuccessful result: %s", apiResp.Result)
	}

	rates := make(map[types.CurrencyType]float64)
	for currencyCode, rate := range apiResp.ConversionRates {
		currencyType := types.CurrencyType(currencyCode)
		if types.IsValidCurrencyType(currencyType) {
			rates[currencyType] = rate
		}
	}

	return rates, nil
}
