package responses

import "time"

type AccessTokenResponse struct {
	ID          uint       `json:"id"`
	Name        string     `json:"name"`
	TokenPrefix string     `json:"tokenPrefix"`
	Scopes      []string   `json:"scopes"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastUsedAt  *time.Time `json:"lastUsedAt"`
	ExpiresAt   time.Time  `json:"expiresAt"`
}

type CreatedAccessTokenResponse struct {
	AccessTokenResponse
	Token string `json:"token"`
}
