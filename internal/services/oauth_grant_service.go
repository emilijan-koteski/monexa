package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

const lastUsedTouchInterval = time.Hour

type OAuthGrantService struct {
	db *gorm.DB
}

func NewOAuthGrantService(db *gorm.DB) *OAuthGrantService {
	return &OAuthGrantService{db: db}
}

func (s *OAuthGrantService) ListOAuthGrants(ctx context.Context, userID uint) ([]models.OAuthGrant, error) {
	grants := []models.OAuthGrant{}
	if err := s.db.WithContext(ctx).
		Preload("Client").
		Where("user_id = ? AND kind = ? AND revoked_at IS NULL", userID, types.OAuthGrantKindOAuth).
		Order("created_at DESC, id DESC").
		Find(&grants).Error; err != nil {
		return nil, fmt.Errorf("failed to list connected apps: %w", err)
	}
	return grants, nil
}

// RevokeGrant revokes one of the user's grants and its tokens, returning gorm.ErrRecordNotFound for any other owner.
func (s *OAuthGrantService) RevokeGrant(ctx context.Context, userID, grantID uint) error {
	return s.revokeOwnedGrant(ctx, "id = ? AND user_id = ?", grantID, userID)
}

// RevokeOAuthGrant revokes one of the user's connected apps, treating a personal access token grant as not found.
func (s *OAuthGrantService) RevokeOAuthGrant(ctx context.Context, userID, grantID uint) error {
	return s.revokeOwnedGrant(ctx, "id = ? AND user_id = ? AND kind = ?", grantID, userID, types.OAuthGrantKindOAuth)
}

func (s *OAuthGrantService) RevokeAllForUser(ctx context.Context, userID uint) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return revokeMatchingGrants(tx, time.Now(), "user_id = ?", userID)
	})
}

// FindOrCreateOAuthGrant reuses the user's active grant for the client with the newly approved scope and resource, or creates one. Run it inside the approval transaction.
func (s *OAuthGrantService) FindOrCreateOAuthGrant(tx *gorm.DB, userID uint, clientID, scope, resource string) (*models.OAuthGrant, error) {
	if err := lockUserRow(tx, userID); err != nil {
		return nil, err
	}

	var grant models.OAuthGrant
	err := tx.Where("user_id = ? AND kind = ? AND client_id = ? AND revoked_at IS NULL", userID, types.OAuthGrantKindOAuth, clientID).
		First(&grant).Error
	switch {
	case err == nil:
		grant.Scope = scope
		grant.Resource = resource
		if err := tx.Model(&grant).Updates(map[string]any{"scope": scope, "resource": resource}).Error; err != nil {
			return nil, fmt.Errorf("failed to update grant: %w", err)
		}
		return &grant, nil
	case errors.Is(err, gorm.ErrRecordNotFound):
		grant = models.OAuthGrant{
			UserID:   userID,
			Kind:     types.OAuthGrantKindOAuth,
			ClientID: &clientID,
			Scope:    scope,
			Resource: resource,
		}
		if err := tx.Create(&grant).Error; err != nil {
			return nil, fmt.Errorf("failed to create grant: %w", err)
		}
		return &grant, nil
	default:
		return nil, fmt.Errorf("failed to look up grant: %w", err)
	}
}

func (s *OAuthGrantService) TouchLastUsed(ctx context.Context, grantID uint) error {
	now := time.Now()
	if err := s.db.WithContext(ctx).
		Model(&models.OAuthGrant{}).
		Where("id = ? AND (last_used_at IS NULL OR last_used_at < ?)", grantID, now.Add(-lastUsedTouchInterval)).
		UpdateColumn("last_used_at", now).Error; err != nil {
		return fmt.Errorf("failed to record grant use: %w", err)
	}
	return nil
}

func (s *OAuthGrantService) revokeOwnedGrant(ctx context.Context, grantQuery string, grantArgs ...any) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Select("id").Where(grantQuery, grantArgs...).First(&models.OAuthGrant{}).Error; err != nil {
			return err
		}
		return revokeMatchingGrants(tx, time.Now(), grantQuery, grantArgs...)
	})
}

func revokeMatchingGrants(tx *gorm.DB, now time.Time, grantQuery string, grantArgs ...any) error {
	matching := tx.Model(&models.OAuthGrant{}).Select("id").Where(grantQuery, grantArgs...)
	if err := tx.Model(&models.OAuthToken{}).
		Where("revoked_at IS NULL AND grant_id IN (?)", matching).
		Update("revoked_at", now).Error; err != nil {
		return fmt.Errorf("failed to revoke tokens: %w", err)
	}
	if err := tx.Model(&models.OAuthGrant{}).
		Where("revoked_at IS NULL AND id IN (?)", matching).
		Update("revoked_at", now).Error; err != nil {
		return fmt.Errorf("failed to revoke grants: %w", err)
	}
	return nil
}

func lockUserRow(tx *gorm.DB, userID uint) error {
	var locked []uint
	if err := tx.Raw("SELECT id FROM users WHERE id = ? FOR NO KEY UPDATE", userID).Scan(&locked).Error; err != nil {
		return fmt.Errorf("failed to lock user: %w", err)
	}
	if len(locked) == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
