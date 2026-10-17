package types

type OAuthGrantKind string

const (
	OAuthGrantKindOAuth OAuthGrantKind = "OAUTH"
	OAuthGrantKindPAT   OAuthGrantKind = "PAT"
)

func IsValidOAuthGrantKind(kind OAuthGrantKind) bool {
	switch kind {
	case OAuthGrantKindOAuth, OAuthGrantKindPAT:
		return true
	default:
		return false
	}
}
