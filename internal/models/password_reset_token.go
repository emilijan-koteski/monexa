package models

import "time"

type PasswordResetToken struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
	UserID    uint       `gorm:"not null;index" json:"userId"`
	TokenHash string     `gorm:"not null;uniqueIndex" json:"-"`
	ExpiresAt time.Time  `gorm:"not null" json:"expiresAt"`
	UsedAt    *time.Time `json:"usedAt"`
}
