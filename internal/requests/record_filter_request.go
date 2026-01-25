package requests

import (
	"time"
)

type RecordFilterRequest struct {
	UserID           *uint
	StartDate        *time.Time `query:"startDate"`
	EndDate          *time.Time `query:"endDate"`
	CategoryID       *uint      `query:"categoryId"`
	PaymentMethodIDs []uint     `query:"paymentMethodIds"`
	Search           *string    `query:"search"`
	SortBy           *string    `query:"sortBy"`
	SortOrder        *string    `query:"sortOrder"`
}
