package dtos

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type RecordExportRow struct {
	PaymentMethodName string
	CategoryName      string
	Amount            float64
	Currency          types.CurrencyType
	Date              time.Time
	Description       *string
}
