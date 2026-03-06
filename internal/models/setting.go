package models

import (
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type Setting struct {
	ID        uint               `gorm:"primaryKey" json:"id"`
	UserID    uint               `gorm:"not null;uniqueIndex:idx_user_setting" json:"userId"`
	DeletedAt gorm.DeletedAt     `gorm:"index" json:"-"`
	Language  types.LanguageType `gorm:"not null" json:"language"`
	Currency  types.CurrencyType `gorm:"not null" json:"currency"`
}
