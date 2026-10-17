package responses

import (
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
)

// verifiedClientLinks returns the client's homepage and logo only when they came from a fetched client metadata document, never from a self-registered client.
func verifiedClientLinks(client *models.OAuthClient) (clientURI, logoURI *string) {
	if client.Kind != types.OAuthClientKindCIMD {
		return nil, nil
	}
	return client.ClientURI, client.LogoURI
}
