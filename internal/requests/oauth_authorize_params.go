package requests

// OAuthAuthorizeParams holds the /oauth/authorize query parameters. State is nil when the parameter was absent.
type OAuthAuthorizeParams struct {
	ResponseType        string
	ClientID            string
	RedirectURI         string
	Scope               string
	State               *string
	CodeChallenge       string
	CodeChallengeMethod string
	Resource            string
}
