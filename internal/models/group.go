package models

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type Group struct {
	ID            uint               `gorm:"primaryKey" json:"id"`
	CreatedAt     time.Time          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     *time.Time         `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt     gorm.DeletedAt     `gorm:"index" json:"-"`
	Name          string             `gorm:"not null" json:"name"`
	Icon          string             `gorm:"not null" json:"icon"`
	Color         string             `gorm:"not null" json:"color"`
	BaseCurrency  types.CurrencyType `gorm:"not null" json:"baseCurrency"`
	StartDate     *time.Time         `json:"startDate"`
	EndDate       *time.Time         `json:"endDate"`
	SimplifyDebts bool               `gorm:"not null" json:"simplifyDebts"`
	InviteCode    *string            `gorm:"uniqueIndex" json:"-"`
	ArchivedAt    *time.Time         `json:"archivedAt"`
}
