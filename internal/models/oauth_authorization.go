package models

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type OAuthAuthorization struct {
	ID            string                         `gorm:"primaryKey" json:"id"`
	CreatedAt     time.Time                      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     *time.Time                     `gorm:"autoUpdateTime" json:"updatedAt"`
	ClientID      string                         `gorm:"not null;index" json:"clientId"`
	UserID        *uint                          `gorm:"index" json:"userId"`
	RedirectURI   string                         `gorm:"not null" json:"redirectUri"`
	State         *string                        `json:"state"`
	Scope         string                         `gorm:"not null" json:"scope"`
	Resource      string                         `gorm:"not null" json:"resource"`
	CodeChallenge string                         `gorm:"not null" json:"codeChallenge"`
	Status        types.OAuthAuthorizationStatus `gorm:"not null" json:"status"`
	ExpiresAt     time.Time                      `gorm:"not null;index" json:"expiresAt"`
	CodeHash      *string                        `gorm:"uniqueIndex" json:"-"`
	CodeExpiresAt *time.Time                     `json:"codeExpiresAt"`
	ConsumedAt    *time.Time                     `json:"consumedAt"`
	GrantID       *uint                          `gorm:"index" json:"grantId"`
	IssuedFamily  *string                        `gorm:"index" json:"issuedFamily"`
	Client        *OAuthClient                   `gorm:"foreignKey:ClientID" json:"client,omitempty"`
}

func (OAuthAuthorization) TableName() string {
	return "oauth_authorizations"
}
