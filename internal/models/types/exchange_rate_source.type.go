package types

type ExchangeRateSourceType string

const (
	ExchangeRateApi ExchangeRateSourceType = "EXCHANGE_RATE_API"
	Fallback        ExchangeRateSourceType = "FALLBACK"
)
