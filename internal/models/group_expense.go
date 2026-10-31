package models

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type GroupExpense struct {
	ID                uint                         `gorm:"primaryKey" json:"id"`
	CreatedAt         time.Time                    `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt         *time.Time                   `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt         gorm.DeletedAt               `gorm:"index" json:"-"`
	GroupID           uint                         `gorm:"not null;index" json:"groupId"`
	ClientID          *string                      `gorm:"type:uuid" json:"clientId"`
	Title             string                       `gorm:"not null" json:"title"`
	Amount            *float64                     `gorm:"type:numeric(14,2)" json:"amount"`
	Currency          types.CurrencyType           `gorm:"not null" json:"currency"`
	ExchangeRate      float64                      `gorm:"type:numeric(20,10);not null" json:"exchangeRate"`
	RateIsManual      bool                         `gorm:"not null" json:"rateIsManual"`
	RateSource        types.ExchangeRateSourceType `gorm:"not null" json:"rateSource"`
	BaseAmount        *float64                     `gorm:"type:numeric(14,2)" json:"baseAmount"`
	Date              time.Time                    `gorm:"not null;index" json:"date"`
	Category          types.GroupExpenseCategory   `gorm:"not null" json:"category"`
	SplitType         types.GroupSplitType         `gorm:"not null" json:"splitType"`
	PaidByMemberID    uint                         `gorm:"not null;index" json:"paidByMemberId"`
	CreatedByMemberID uint                         `gorm:"not null" json:"createdByMemberId"`
	UpdatedByMemberID *uint                        `json:"updatedByMemberId"`
	Note              *string                      `json:"note"`
	Version           int                          `gorm:"not null" json:"version"`
	Shares            []GroupExpenseShare          `gorm:"foreignKey:ExpenseID" json:"shares"`
}
