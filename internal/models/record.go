package models

import (
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
	"time"
)

type Record struct {
	ID              uint               `gorm:"primaryKey" json:"id"`
	CreatedAt       time.Time          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt       *time.Time         `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt       gorm.DeletedAt     `gorm:"index" json:"-"`
	UserID          uint               `gorm:"not null;index" json:"userId"`
	CategoryID      uint               `gorm:"not null;index" json:"categoryId"`
	PaymentMethodID uint               `gorm:"not null;index" json:"paymentMethodId"`
	Amount          float64            `gorm:"not null" json:"amount"`
	Currency        types.CurrencyType `gorm:"not null" json:"currency"`
	Description     *string            `json:"description"`
	Date            time.Time          `gorm:"not null" json:"date"`
}
