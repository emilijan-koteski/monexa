package requests

import (
	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type SettingRequest struct {
	ID       *uint
	UserID   *uint
	Language *types.LanguageType `json:"language"`
	Currency *types.CurrencyType `json:"currency"`
}
