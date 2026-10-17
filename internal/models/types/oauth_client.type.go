package types

type OAuthClientKind string

const (
	OAuthClientKindDCR  OAuthClientKind = "DCR"
	OAuthClientKindCIMD OAuthClientKind = "CIMD"
)

func IsValidOAuthClientKind(kind OAuthClientKind) bool {
	switch kind {
	case OAuthClientKindDCR, OAuthClientKindCIMD:
		return true
	default:
		return false
	}
}
