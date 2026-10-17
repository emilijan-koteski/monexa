package services

import "errors"

var (
	ErrOAuthInvalidClient         = errors.New("invalid_client")
	ErrOAuthInvalidGrant          = errors.New("invalid_grant")
	ErrOAuthInvalidRequest        = errors.New("invalid_request")
	ErrOAuthInvalidScope          = errors.New("invalid_scope")
	ErrOAuthInvalidTarget         = errors.New("invalid_target")
	ErrOAuthUnsupportedGrantType  = errors.New("unsupported_grant_type")
	ErrOAuthAccessDenied          = errors.New("access_denied")
	ErrOAuthAuthorizationNotFound = errors.New("authorization not found")
	ErrOAuthCodeReplayed          = errors.New("authorization code already used")
	ErrOAuthInvalidRedirectURI    = errors.New("invalid_redirect_uri")
	ErrAccessTokenLimitReached    = errors.New("access token limit reached")
	ErrAccessTokenInvalid         = errors.New("invalid access token request")
)

// OAuthNoRedirectError rejects an /authorize request whose client or redirect_uri is not trusted, so the user sees an error page instead.
type OAuthNoRedirectError struct {
	Code        string
	Description string
}

func (e *OAuthNoRedirectError) Error() string {
	return e.Code + ": " + e.Description
}

// OAuthRedirectError rejects an /authorize request by sending the user back to the client's validated redirect URI.
type OAuthRedirectError struct {
	RedirectURL string
}

func (e *OAuthRedirectError) Error() string {
	return "authorization request rejected with a redirect to the client"
}
