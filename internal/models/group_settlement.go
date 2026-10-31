package models

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type GroupSettlement struct {
	ID                uint               `gorm:"primaryKey" json:"id"`
	CreatedAt         time.Time          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt         *time.Time         `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt         gorm.DeletedAt     `gorm:"index" json:"-"`
	GroupID           uint               `gorm:"not null;index" json:"groupId"`
	ClientID          *string            `gorm:"type:uuid" json:"clientId"`
	FromMemberID      uint               `gorm:"not null" json:"fromMemberId"`
	ToMemberID        uint               `gorm:"not null" json:"toMemberId"`
	Amount            float64            `gorm:"type:numeric(14,2);not null" json:"amount"`
	Currency          types.CurrencyType `gorm:"not null" json:"currency"`
	ExchangeRate      float64            `gorm:"type:numeric(20,10);not null" json:"exchangeRate"`
	BaseAmount        float64            `gorm:"type:numeric(14,2);not null" json:"baseAmount"`
	Date              time.Time          `gorm:"not null" json:"date"`
	Note              *string            `json:"note"`
	ShareID           *uint              `gorm:"index" json:"shareId"`
	CreatedByMemberID uint               `gorm:"not null" json:"createdByMemberId"`
}
