package types

import "slices"

type CurrencyType string

const (
	MacedonianDenar  CurrencyType = "MKD"
	Euro             CurrencyType = "EUR"
	USDollar         CurrencyType = "USD"
	AustralianDollar CurrencyType = "AUD"
	SwissFranc       CurrencyType = "CHF"
	BritishPound     CurrencyType = "GBP"
	HungarianForint  CurrencyType = "HUF"
	SerbianDinar     CurrencyType = "RSD"
)

var supportedCurrencies = []CurrencyType{
	MacedonianDenar,
	Euro,
	USDollar,
	AustralianDollar,
	SwissFranc,
	BritishPound,
	HungarianForint,
	SerbianDinar,
}

// SupportedCurrencies returns every currency the app accepts, in display order.
func SupportedCurrencies() []CurrencyType {
	return slices.Clone(supportedCurrencies)
}

func IsValidCurrencyType(currencyType CurrencyType) bool {
	return slices.Contains(supportedCurrencies, currencyType)
}
