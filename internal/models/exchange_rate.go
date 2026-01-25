package models

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type ExchangeRate struct {
	ID           uint                         `gorm:"primaryKey" json:"id"`
	CreatedAt    time.Time                    `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt    *time.Time                   `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt    gorm.DeletedAt               `json:"-" sql:"index"`
	FromCurrency types.CurrencyType           `gorm:"not null;index:idx_currency_pair" json:"fromCurrency"`
	ToCurrency   types.CurrencyType           `gorm:"not null;index:idx_currency_pair" json:"toCurrency"`
	Rate         float64                      `gorm:"not null" json:"rate"`
	Source       types.ExchangeRateSourceType `gorm:"not null" json:"source"`
	FetchedAt    time.Time                    `gorm:"not null;index" json:"fetchedAt"`
}
