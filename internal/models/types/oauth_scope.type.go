package types

type OAuthScope string

const (
	ScopeRead          OAuthScope = "monexa.read"
	ScopeWrite         OAuthScope = "monexa.write"
	ScopeOfflineAccess OAuthScope = "offline_access"
)

func IsValidOAuthScope(scope OAuthScope) bool {
	switch scope {
	case ScopeRead, ScopeWrite, ScopeOfflineAccess:
		return true
	default:
		return false
	}
}
