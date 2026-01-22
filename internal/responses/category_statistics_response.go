package responses

import "github.com/emilijan-koteski/monexa/internal/models/types"

type CategoryStatItem struct {
	CategoryID   uint               `json:"categoryId"`
	CategoryName string             `json:"categoryName"`
	CategoryType types.CategoryType `json:"categoryType"`
	Color        *string            `json:"color"`
	RecordCount  int                `json:"recordCount"`
	TotalAmount  float64            `json:"totalAmount"`
}

type CategoryStatisticsResponse struct {
	TotalIncome  float64            `json:"totalIncome"`
	TotalExpense float64            `json:"totalExpense"`
	NetBalance   float64            `json:"netBalance"`
	Currency     types.CurrencyType `json:"currency"`
	Categories   []CategoryStatItem `json:"categories"`
}
