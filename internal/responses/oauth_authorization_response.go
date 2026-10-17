package responses

import (
	"net/url"
	"strings"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
)

var defaultPortsByScheme = map[string]string{
	"http":  "80",
	"https": "443",
}

type OAuthAuthorizationResponse struct {
	ID           string                `json:"id"`
	ClientID     string                `json:"clientId"`
	ClientName   string                `json:"clientName"`
	ClientKind   types.OAuthClientKind `json:"clientKind"`
	ClientURI    *string               `json:"clientUri"`
	LogoURI      *string               `json:"logoUri"`
	RedirectURI  string                `json:"redirectUri"`
	RedirectHost string                `json:"redirectHost"`
	Scopes       []string              `json:"scopes"`
	ExpiresAt    time.Time             `json:"expiresAt"`
}

// NewOAuthAuthorizationResponse describes a pending authorization, with its client preloaded, for the consent page.
func NewOAuthAuthorizationResponse(authorization *models.OAuthAuthorization) OAuthAuthorizationResponse {
	clientURI, logoURI := verifiedClientLinks(authorization.Client)
	return OAuthAuthorizationResponse{
		ID:           authorization.ID,
		ClientID:     authorization.ClientID,
		ClientName:   authorization.Client.Name,
		ClientKind:   authorization.Client.Kind,
		ClientURI:    clientURI,
		LogoURI:      logoURI,
		RedirectURI:  authorization.RedirectURI,
		RedirectHost: redirectHost(authorization.RedirectURI),
		Scopes:       strings.Fields(authorization.Scope),
		ExpiresAt:    authorization.ExpiresAt,
	}
}

func redirectHost(redirectURI string) string {
	parsed, err := url.Parse(redirectURI)
	if err != nil {
		return ""
	}
	port := parsed.Port()
	if port != "" && port == defaultPortsByScheme[parsed.Scheme] {
		return strings.TrimSuffix(parsed.Host, ":"+port)
	}
	return parsed.Host
}
