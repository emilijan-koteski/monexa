package responses

import "github.com/emilijan-koteski/monexa/internal/models/types"

type RecordSummaryResponse struct {
	Amount   float64            `json:"amount"`
	Currency types.CurrencyType `json:"currency"`
}
