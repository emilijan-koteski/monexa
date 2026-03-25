package services

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type LegalDocumentService struct {
	db                     *gorm.DB
	legalComplianceEnabled bool
	cacheMu                sync.RWMutex
	cachedEffectiveAt      *time.Time
	cacheExpiry            time.Time
	cacheTTL               time.Duration
}

func NewLegalDocumentService(db *gorm.DB, enabled bool) *LegalDocumentService {
	return &LegalDocumentService{
		db:                     db,
		legalComplianceEnabled: enabled,
		cacheTTL:               1 * time.Hour,
	}
}

func (s *LegalDocumentService) IsEnabled() bool {
	return s.legalComplianceEnabled
}

func (s *LegalDocumentService) GetLegalAcceptedAt(ctx context.Context, userID uint) *time.Time {
	if !s.legalComplianceEnabled {
		return nil
	}
	hasPending, err := s.HasPendingDocuments(ctx, userID)
	if err != nil || hasPending {
		return nil
	}
	acceptedAt, err := s.GetLatestAcceptanceForUser(ctx, userID)
	if err != nil {
		return nil
	}
	return acceptedAt
}

func (s *LegalDocumentService) GetLatestEffectiveAt(ctx context.Context) (*time.Time, error) {
	now := time.Now()

	s.cacheMu.RLock()
	if s.cachedEffectiveAt != nil && now.Before(s.cacheExpiry) {
		cached := s.cachedEffectiveAt
		s.cacheMu.RUnlock()
		return cached, nil
	}
	s.cacheMu.RUnlock()

	var result struct {
		MaxEffectiveAt *time.Time
	}
	err := s.db.WithContext(ctx).
		Model(&models.LegalDocument{}).
		Select("MAX(effective_at) as max_effective_at").
		Where("is_active = ? AND requires_reconsent = ? AND effective_at <= ?", true, true, now).
		Scan(&result).Error
	if err != nil {
		return nil, err
	}

	s.cacheMu.Lock()
	s.cachedEffectiveAt = result.MaxEffectiveAt
	s.cacheExpiry = now.Add(s.cacheTTL)
	s.cacheMu.Unlock()

	return result.MaxEffectiveAt, nil
}

func (s *LegalDocumentService) GetLatestAcceptanceForUser(ctx context.Context, userID uint) (*time.Time, error) {
	var result struct {
		MaxAcceptedAt *time.Time
	}
	err := s.db.WithContext(ctx).
		Model(&models.UserLegalAcceptance{}).
		Select("MAX(accepted_at) as max_accepted_at").
		Where("user_id = ?", userID).
		Scan(&result).Error
	if err != nil {
		return nil, err
	}
	return result.MaxAcceptedAt, nil
}

func (s *LegalDocumentService) GetActiveDocuments(ctx context.Context) ([]models.LegalDocument, error) {
	var documents []models.LegalDocument
	err := s.db.WithContext(ctx).
		Where("is_active = ? AND effective_at <= ?", true, time.Now()).
		Order("type ASC").
		Find(&documents).Error
	return documents, err
}

func (s *LegalDocumentService) GetActiveDocumentByType(ctx context.Context, docType types.DocumentType) (*models.LegalDocument, error) {
	if !types.IsValidDocumentType(docType) {
		return nil, errors.New("invalid document type")
	}

	var document models.LegalDocument
	err := s.db.WithContext(ctx).
		Where("type = ? AND is_active = ? AND effective_at <= ?", docType, true, time.Now()).
		First(&document).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("document not found")
		}
		return nil, err
	}
	return &document, nil
}

func (s *LegalDocumentService) GetPendingDocuments(ctx context.Context, userID uint) ([]models.LegalDocument, error) {
	var pendingDocs []models.LegalDocument

	acceptedSubquery := s.db.Table("user_legal_acceptances").
		Select("legal_document_id").
		Where("user_id = ?", userID)

	err := s.db.WithContext(ctx).
		Where("is_active = ? AND requires_reconsent = ? AND effective_at <= ?", true, true, time.Now()).
		Where("id NOT IN (?)", acceptedSubquery).
		Order("type ASC").
		Find(&pendingDocs).Error

	return pendingDocs, err
}

func (s *LegalDocumentService) HasPendingDocuments(ctx context.Context, userID uint) (bool, error) {
	docs, err := s.GetPendingDocuments(ctx, userID)
	if err != nil {
		return false, err
	}
	return len(docs) > 0, nil
}

func (s *LegalDocumentService) GetRequiredDocumentCount(ctx context.Context) (int, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&models.LegalDocument{}).
		Where("is_active = ? AND requires_reconsent = ? AND effective_at <= ?", true, true, time.Now()).
		Count(&count).Error
	return int(count), err
}

func (s *LegalDocumentService) AcceptDocument(ctx context.Context, userID uint, documentID uint, ipAddress, userAgent string) error {
	var document models.LegalDocument
	if err := s.db.WithContext(ctx).
		Where("id = ? AND is_active = ?", documentID, true).
		First(&document).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("document not found or not active")
		}
		return err
	}

	var existing models.UserLegalAcceptance
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND legal_document_id = ?", userID, documentID).
		First(&existing).Error
	if err == nil {
		return errors.New("document already accepted")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	acceptance := models.UserLegalAcceptance{
		UserID:          userID,
		LegalDocumentID: documentID,
		AcceptedAt:      time.Now(),
		IPAddress:       &ipAddress,
		UserAgent:       &userAgent,
	}

	return s.db.WithContext(ctx).Create(&acceptance).Error
}

func (s *LegalDocumentService) AcceptDocuments(ctx context.Context, userID uint, documentIDs []uint, ipAddress, userAgent string) error {
	return s.AcceptDocumentsTx(ctx, s.db, userID, documentIDs, ipAddress, userAgent)
}

func (s *LegalDocumentService) AcceptDocumentsTx(ctx context.Context, tx *gorm.DB, userID uint, documentIDs []uint, ipAddress, userAgent string) error {
	if len(documentIDs) == 0 {
		return nil
	}

	var documents []models.LegalDocument
	if err := tx.WithContext(ctx).
		Where("id IN ? AND is_active = ? AND requires_reconsent = ?", documentIDs, true, true).
		Find(&documents).Error; err != nil {
		return err
	}

	if len(documents) != len(documentIDs) {
		return errors.New("one or more documents not found or not active")
	}

	now := time.Now()
	acceptances := make([]models.UserLegalAcceptance, len(documentIDs))
	for i, docID := range documentIDs {
		acceptances[i] = models.UserLegalAcceptance{
			UserID:          userID,
			LegalDocumentID: docID,
			AcceptedAt:      now,
			IPAddress:       &ipAddress,
			UserAgent:       &userAgent,
		}
	}

	return tx.WithContext(ctx).Create(&acceptances).Error
}
