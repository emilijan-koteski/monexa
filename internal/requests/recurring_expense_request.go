package requests

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type RecurringExpenseRequest struct {
	ID              *uint
	UserID          *uint
	CategoryID      *uint                `json:"categoryId"`
	PaymentMethodID *uint                `json:"paymentMethodId"`
	Amount          *float64             `json:"amount"`
	Currency        *types.CurrencyType  `json:"currency"`
	Description     *string              `json:"description"`
	Frequency       *types.FrequencyType `json:"frequency"`
	StartDate       *time.Time           `json:"startDate"`
	EndDate         *time.Time           `json:"endDate"`
	ClearEndDate    *bool                `json:"clearEndDate"`
	IsActive        *bool                `json:"isActive"`
}
