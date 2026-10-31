package requests

import "github.com/emilijan-koteski/monexa/internal/models/types"

type ExchangeRateQuoteRequest struct {
	From types.CurrencyType `query:"from"`
	To   types.CurrencyType `query:"to"`
	Date string             `query:"date"`
}
