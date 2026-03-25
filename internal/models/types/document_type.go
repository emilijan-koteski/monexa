package types

type DocumentType string

const (
	PrivacyPolicy  DocumentType = "PRIVACY_POLICY"
	TermsOfService DocumentType = "TERMS_OF_SERVICE"
)

func IsValidDocumentType(documentType DocumentType) bool {
	switch documentType {
	case PrivacyPolicy, TermsOfService:
		return true
	default:
		return false
	}
}
