package responses

import "github.com/emilijan-koteski/monexa/internal/models/types"

type MonthlyDataPoint struct {
	Month  int     `json:"month"`
	Amount float64 `json:"amount"`
}

type TrendReportMonthlyDataResponse struct {
	Data     []MonthlyDataPoint `json:"data"`
	Currency types.CurrencyType `json:"currency"`
	Year     int                `json:"year"`
}
