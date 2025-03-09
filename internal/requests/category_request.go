package requests

import (
	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type CategoryRequest struct {
	ID          *uint
	UserID      *uint
	Name        *string             `json:"name"`
	Type        *types.CategoryType `json:"type"`
	Description *string             `json:"description"`
	Color       *string             `json:"color"`
}
