package requests

type TrendReportRequest struct {
	ID          *uint
	UserID      *uint
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Color       *string `json:"color"`
	CategoryIDs []uint  `json:"categoryIds"`
}
