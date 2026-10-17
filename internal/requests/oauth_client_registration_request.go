package requests

type OAuthClientRegistrationRequest struct {
	RedirectURIs            []string `json:"redirect_uris"`
	ClientName              string   `json:"client_name"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	ClientURI               *string  `json:"client_uri"`
	LogoURI                 *string  `json:"logo_uri"`
	Scope                   string   `json:"scope"`
}
