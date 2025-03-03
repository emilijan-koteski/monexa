package models

import "time"

type Session struct {
	ID           string     `gorm:"primaryKey" json:"id"`            // Equal to the Refresh Token's ID
	CreatedAt    time.Time  `gorm:"autoCreateTime" json:"createdAt"` // Equal to the Refresh Token's IssuedAt
	UpdatedAt    *time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
	UserID       uint       `gorm:"not null;index" json:"userId"`
	RefreshToken string     `gorm:"not null" json:"refreshToken"`
	IsRevoked    bool       `gorm:"not null" json:"isRevoked"`
	ExpiresAt    time.Time  `gorm:"not null" json:"expiresAt"` // Equal to the Refresh Token's ExpiresAt
}
