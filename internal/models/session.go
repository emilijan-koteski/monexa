package models

import "time"

type Session struct {
	ID           string     `gorm:"primaryKey" json:"id"`
	CreatedAt    time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt    *time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
	UserID       uint       `gorm:"not null;index" json:"userId"`
	RefreshToken string     `gorm:"not null" json:"refreshToken"`
	IsRevoked    bool       `gorm:"not null" json:"isRevoked"`
	ExpiresAt    time.Time  `gorm:"not null" json:"expiresAt"`
}
