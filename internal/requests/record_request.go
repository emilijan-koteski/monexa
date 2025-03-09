package requests

import (
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"time"
)

type RecordRequest struct {
	ID              *uint
	UserID          *uint
	CategoryID      *uint               `json:"categoryId"`
	PaymentMethodID *uint               `json:"paymentMethodId"`
	Amount          *float64            `json:"amount"`
	Currency        *types.CurrencyType `json:"currency"`
	Description     *string             `json:"description"`
	Date            *time.Time          `json:"date"`
}
