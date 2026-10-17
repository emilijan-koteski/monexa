package requests

// OAuthAuthorizeParams holds the /oauth/authorize query parameters. State is nil when absent or repeated,
// and RepeatedParameter names a parameter the request sent more than once.
type OAuthAuthorizeParams struct {
	ResponseType        string
	ClientID            string
	RedirectURI         string
	Scope               string
	State               *string
	CodeChallenge       string
	CodeChallengeMethod string
	Resource            string
	RepeatedParameter   string
}
