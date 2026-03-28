package dtos

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type ProfileExportRow struct {
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
}

type CategoryExportRow struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
}

type PaymentMethodExportRow struct {
	Name string `json:"name"`
}

type PreferencesExportRow struct {
	Language string `json:"language"`
	Currency string `json:"currency"`
}

type ConsentExportRow struct {
	Document   string    `json:"document"`
	Version    int       `json:"version"`
	AcceptedAt time.Time `json:"acceptedAt"`
	IPAddress  string    `json:"ipAddress"`
	UserAgent  string    `json:"userAgent"`
}

type RecordExportRow struct {
	PaymentMethodName string             `json:"paymentMethod"`
	CategoryName      string             `json:"category"`
	Amount            float64            `json:"amount"`
	Currency          types.CurrencyType `json:"currency"`
	Date              time.Time          `json:"date"`
	Description       *string            `json:"description"`
}
