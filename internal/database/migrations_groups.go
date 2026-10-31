package database

import (
	"time"

	"gorm.io/gorm"
)

var hufRsdFallbackPerEuro = map[string]float64{
	"MKD": 61.55,
	"EUR": 1,
	"USD": 1.17,
	"AUD": 1.70,
	"CHF": 0.92,
	"GBP": 0.87,
	"HUF": 390.0,
	"RSD": 117.2,
}

func isHufOrRsd(currency string) bool {
	return currency == "HUF" || currency == "RSD"
}

// migrateHufRsdFallbackRates seeds approximate rates for every pair involving HUF or RSD, derived from a frozen per-EUR table.
func migrateHufRsdFallbackRates(tx *gorm.DB) error {
	now := time.Now()
	for from, fromPerEuro := range hufRsdFallbackPerEuro {
		for to, toPerEuro := range hufRsdFallbackPerEuro {
			if from == to || (!isHufOrRsd(from) && !isHufOrRsd(to)) {
				continue
			}
			row := map[string]interface{}{
				"from_currency": from,
				"to_currency":   to,
				"rate":          toPerEuro / fromPerEuro,
				"source":        "FALLBACK",
				"fetched_at":    now,
				"created_at":    now,
			}
			if err := tx.Table("exchange_rates").Create(row).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func rollbackHufRsdFallbackRates(tx *gorm.DB) error {
	return tx.Exec(`DELETE FROM exchange_rates WHERE from_currency IN ('HUF', 'RSD') OR to_currency IN ('HUF', 'RSD')`).Error
}
