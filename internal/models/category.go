package models

import "github.com/emilijan-koteski/monexa/internal/models/types"

type Category struct {
	ID          uint               `gorm:"primaryKey" json:"id"`
	UserID      uint               `gorm:"not null;index" json:"userId"`
	Name        string             `gorm:"not null" json:"name"`
	Type        types.CategoryType `gorm:"not null" json:"type"`
	Description *string            `json:"description"`
}
