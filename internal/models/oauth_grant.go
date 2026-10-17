package models

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type OAuthGrant struct {
	ID         uint                 `gorm:"primaryKey" json:"id"`
	CreatedAt  time.Time            `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt  *time.Time           `gorm:"autoUpdateTime" json:"updatedAt"`
	UserID     uint                 `gorm:"not null;index" json:"userId"`
	Kind       types.OAuthGrantKind `gorm:"not null" json:"kind"`
	ClientID   *string              `gorm:"index" json:"clientId"`
	Name       *string              `json:"name"`
	Scope      string               `gorm:"not null" json:"scope"`
	Resource   string               `gorm:"not null" json:"resource"`
	LastUsedAt *time.Time           `json:"lastUsedAt"`
	RevokedAt  *time.Time           `gorm:"index" json:"revokedAt"`
	ExpiresAt  *time.Time           `json:"expiresAt"`
	Client     *OAuthClient         `gorm:"foreignKey:ClientID" json:"client,omitempty"`
}

func (OAuthGrant) TableName() string {
	return "oauth_grants"
}
