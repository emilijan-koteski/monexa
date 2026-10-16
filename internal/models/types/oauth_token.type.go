package types

type OAuthTokenType string

const (
	OAuthAccessToken         OAuthTokenType = "access"
	OAuthRefreshToken        OAuthTokenType = "refresh"
	OAuthPersonalAccessToken OAuthTokenType = "pat"
)

func IsValidOAuthTokenType(tokenType OAuthTokenType) bool {
	switch tokenType {
	case OAuthAccessToken, OAuthRefreshToken, OAuthPersonalAccessToken:
		return true
	default:
		return false
	}
}
