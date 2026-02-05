package models

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type LegalDocument struct {
	ID                uint               `gorm:"primaryKey" json:"id"`
	CreatedAt         time.Time          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt         *time.Time         `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt         gorm.DeletedAt     `gorm:"index" json:"-"`
	Type              types.DocumentType `gorm:"not null" json:"type"`
	Version           int                `gorm:"not null" json:"version"`
	Title             string             `gorm:"not null" json:"title"`
	Content           string             `gorm:"not null" json:"content"`
	EffectiveAt       time.Time          `gorm:"not null" json:"effectiveAt"`
	IsActive          bool               `gorm:"not null;default:false" json:"isActive"`
	RequiresReconsent bool               `gorm:"not null;default:true" json:"requiresReconsent"`
}
