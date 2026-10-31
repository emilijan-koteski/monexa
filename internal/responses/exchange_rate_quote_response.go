package responses

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type ExchangeRateQuoteResponse struct {
	From      types.CurrencyType           `json:"from"`
	To        types.CurrencyType           `json:"to"`
	Date      string                       `json:"date"`
	Rate      float64                      `json:"rate"`
	Source    types.ExchangeRateSourceType `json:"source"`
	FetchedAt *time.Time                   `json:"fetchedAt"`
}
