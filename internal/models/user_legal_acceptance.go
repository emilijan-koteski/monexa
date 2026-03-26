package models

import (
	"time"

	"gorm.io/gorm"
)

type UserLegalAcceptance struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	CreatedAt       time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
	UserID          uint           `gorm:"not null;index" json:"userId"`
	LegalDocumentID uint           `gorm:"not null" json:"legalDocumentId"`
	AcceptedAt      time.Time      `gorm:"not null" json:"acceptedAt"`
	IPAddress       *string        `json:"-"`
	UserAgent       *string        `json:"-"`
	ContentHash     string         `gorm:"not null" json:"-"`
}
