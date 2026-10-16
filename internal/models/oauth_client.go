package models

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type OAuthClient struct {
	ID           string                `gorm:"primaryKey" json:"id"`
	CreatedAt    time.Time             `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt    *time.Time            `gorm:"autoUpdateTime" json:"updatedAt"`
	Kind         types.OAuthClientKind `gorm:"not null" json:"kind"`
	Name         string                `gorm:"not null" json:"name"`
	RedirectURIs []string              `gorm:"serializer:json;type:jsonb;not null" json:"redirectUris"`
	ClientURI    *string               `json:"clientUri"`
	LogoURI      *string               `json:"logoUri"`
	ExpiresAt    *time.Time            `json:"expiresAt"`
}

func (OAuthClient) TableName() string {
	return "oauth_clients"
}
