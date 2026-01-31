package types

type CurrencyType string

const (
	MacedonianDenar  CurrencyType = "MKD"
	Euro             CurrencyType = "EUR"
	USDollar         CurrencyType = "USD"
	AustralianDollar CurrencyType = "AUD"
	SwissFranc       CurrencyType = "CHF"
	BritishPound     CurrencyType = "GBP"
)

func IsValidCurrencyType(currencyType CurrencyType) bool {
	switch currencyType {
	case MacedonianDenar, Euro, USDollar, AustralianDollar, SwissFranc, BritishPound:
		return true
	default:
		return false
	}
}
