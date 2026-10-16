package types

type OAuthAuthorizationStatus string

const (
	OAuthAuthorizationPending  OAuthAuthorizationStatus = "PENDING"
	OAuthAuthorizationApproved OAuthAuthorizationStatus = "APPROVED"
	OAuthAuthorizationDenied   OAuthAuthorizationStatus = "DENIED"
)

func IsValidOAuthAuthorizationStatus(status OAuthAuthorizationStatus) bool {
	switch status {
	case OAuthAuthorizationPending, OAuthAuthorizationApproved, OAuthAuthorizationDenied:
		return true
	default:
		return false
	}
}
