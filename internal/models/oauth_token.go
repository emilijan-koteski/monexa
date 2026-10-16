package models

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type OAuthToken struct {
	ID          uint                 `gorm:"primaryKey" json:"id"`
	CreatedAt   time.Time            `gorm:"autoCreateTime" json:"createdAt"`
	GrantID     uint                 `gorm:"not null;index" json:"grantId"`
	Type        types.OAuthTokenType `gorm:"not null" json:"type"`
	TokenHash   string               `gorm:"not null;uniqueIndex" json:"-"`
	TokenPrefix string               `gorm:"not null" json:"tokenPrefix"`
	Family      string               `gorm:"not null;index" json:"family"`
	ParentID    *uint                `json:"parentId"`
	Scope       string               `gorm:"not null" json:"scope"`
	UsedAt      *time.Time           `json:"usedAt"`
	RevokedAt   *time.Time           `json:"revokedAt"`
	ExpiresAt   time.Time            `gorm:"not null;index" json:"expiresAt"`
	Grant       *OAuthGrant          `gorm:"foreignKey:GrantID" json:"grant,omitempty"`
}

func (OAuthToken) TableName() string {
	return "oauth_tokens"
}
