package responses

import "github.com/emilijan-koteski/monexa/internal/models/types"

type MonthlyDetailItem struct {
	Label        string  `json:"label"`
	CategoryName string  `json:"categoryName"`
	CategoryID   uint    `json:"categoryId"`
	Amount       float64 `json:"amount"`
	IsUngrouped  bool    `json:"isUngrouped"`
}

type MonthlyDetailGroup struct {
	Month int                 `json:"month"`
	Items []MonthlyDetailItem `json:"items"`
}

type TrendReportMonthlyDetailsResponse struct {
	Data     []MonthlyDetailGroup `json:"data"`
	Currency types.CurrencyType   `json:"currency"`
	Year     int                  `json:"year"`
}
