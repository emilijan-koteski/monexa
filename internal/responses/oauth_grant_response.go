package responses

import (
	"strings"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type OAuthGrantResponse struct {
	ID         uint                  `json:"id"`
	ClientID   string                `json:"clientId"`
	ClientName string                `json:"clientName"`
	ClientKind types.OAuthClientKind `json:"clientKind"`
	ClientURI  *string               `json:"clientUri"`
	Scopes     []string              `json:"scopes"`
	CreatedAt  time.Time             `json:"createdAt"`
	LastUsedAt *time.Time            `json:"lastUsedAt"`
}

// NewOAuthGrantResponse describes one connected app from an OAuth grant with its client preloaded.
func NewOAuthGrantResponse(grant *models.OAuthGrant) OAuthGrantResponse {
	clientURI, _ := verifiedClientLinks(grant.Client)
	return OAuthGrantResponse{
		ID:         grant.ID,
		ClientID:   grant.Client.ID,
		ClientName: grant.Client.Name,
		ClientKind: grant.Client.Kind,
		ClientURI:  clientURI,
		Scopes:     strings.Fields(grant.Scope),
		CreatedAt:  grant.CreatedAt,
		LastUsedAt: grant.LastUsedAt,
	}
}

// NewOAuthGrantResponses maps a user's connected apps to their responses, always returning a non-nil slice.
func NewOAuthGrantResponses(grants []models.OAuthGrant) []OAuthGrantResponse {
	result := make([]OAuthGrantResponse, 0, len(grants))
	for i := range grants {
		result = append(result, NewOAuthGrantResponse(&grants[i]))
	}
	return result
}
