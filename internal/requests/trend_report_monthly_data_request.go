package requests

import "github.com/emilijan-koteski/monexa/internal/models/types"

type TrendReportMonthlyDataRequest struct {
	ReportID uint
	UserID   uint
	Year     int
	Type     *types.CategoryType
}
