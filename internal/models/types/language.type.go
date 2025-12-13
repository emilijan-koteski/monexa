package types

type LanguageType string

const (
	MacedonianLanguage LanguageType = "MK"
	EnglishLanguage    LanguageType = "EN"
)

func IsValidLanguageType(languageType LanguageType) bool {
	switch languageType {
	case MacedonianLanguage, EnglishLanguage:
		return true
	default:
		return false
	}
}
