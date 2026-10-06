package models

import (
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
	"time"
)

type RecurringExpense struct {
	ID              uint                `gorm:"primaryKey" json:"id"`
	CreatedAt       time.Time           `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt       *time.Time          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt       gorm.DeletedAt      `gorm:"index" json:"-"`
	UserID          uint                `gorm:"not null;index" json:"userId"`
	CategoryID      uint                `gorm:"not null;index" json:"categoryId"`
	PaymentMethodID uint                `gorm:"not null;index" json:"paymentMethodId"`
	Amount          float64             `gorm:"not null" json:"amount"`
	Currency        types.CurrencyType  `gorm:"not null" json:"currency"`
	Description     *string             `json:"description"`
	Frequency       types.FrequencyType `gorm:"not null" json:"frequency"`
	StartDate       time.Time           `gorm:"not null" json:"startDate"`
	EndDate         *time.Time          `json:"endDate"`
	IsActive        bool                `gorm:"not null;default:true" json:"isActive"`
	NextRunDate     time.Time           `gorm:"not null;index" json:"nextRunDate"`
	LastGeneratedAt *time.Time          `json:"lastGeneratedAt"`
}
