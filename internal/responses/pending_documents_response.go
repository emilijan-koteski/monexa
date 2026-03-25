package responses

import "github.com/emilijan-koteski/monexa/internal/models"

type PendingDocumentsResponse struct {
	HasPendingDocuments bool                   `json:"hasPendingDocuments"`
	PendingDocuments    []models.LegalDocument `json:"pendingDocuments"`
}
