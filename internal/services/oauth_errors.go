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
)
