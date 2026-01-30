package models

import (
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type Category struct {
	ID          uint               `gorm:"primaryKey" json:"id"`
	UserID      uint               `gorm:"not null;index" json:"userId"`
	DeletedAt   gorm.DeletedAt     `gorm:"index" json:"-"`
	Name        string             `gorm:"not null" json:"name"`
	Type        types.CategoryType `gorm:"not null" json:"type"`
	Description *string            `json:"description"`
	Color       *string            `json:"color"`
}
