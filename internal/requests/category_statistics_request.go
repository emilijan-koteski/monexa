package requests

import "time"

type CategoryStatisticsRequest struct {
	UserID           *uint      `query:"userId"`
	StartDate        *time.Time `query:"startDate"`
	EndDate          *time.Time `query:"endDate"`
	PaymentMethodIDs []uint     `query:"paymentMethodIds"`
	Search           *string    `query:"search"`
}
