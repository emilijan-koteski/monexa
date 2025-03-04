package types

type CurrencyType string

const (
	MacedonianDenar CurrencyType = "MKD"
	Euro            CurrencyType = "EUR"
	USDollar        CurrencyType = "USD"
)

func IsValidCurrencyType(currencyType CurrencyType) bool {
	switch currencyType {
	case MacedonianDenar, Euro, USDollar:
		return true
	default:
		return false
	}
}
