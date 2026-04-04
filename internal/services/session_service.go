package services

import (
	"context"
	"errors"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"gorm.io/gorm"
)

type SessionService struct {
	db *gorm.DB
}

func NewSessionService(db *gorm.DB) *SessionService {
	return &SessionService{db: db}
}

func (s *SessionService) GetSessionByExample(ctx context.Context, example models.Session) (*models.Session, error) {
	var session models.Session
	if err := s.db.WithContext(ctx).
		Where(&example).
		First(&session).
		Error; err != nil {
		return nil, err
	}

	return &session, nil
}

func (s *SessionService) CreateSessionFromExample(ctx context.Context, example models.Session) (*models.Session, error) {
	if example.ID == "" {
		return nil, errors.New("id is required")
	}
	if example.UserID == 0 {
		return nil, errors.New("user id is required")
	}
	if example.RefreshToken == "" {
		return nil, errors.New("refresh token is required")
	}
	if example.TokenFamily == "" {
		return nil, errors.New("token family is required")
	}
	if example.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("expiration time must be in the future")
	}

	if err := s.db.WithContext(ctx).Create(&example).Error; err != nil {
		return nil, err
	}

	return &example, nil
}

func (s *SessionService) RevokeSession(ctx context.Context, req requests.RefreshTokenRequest) error {
	if req.RefreshToken == "" {
		return errors.New("refresh token is required")
	}

	result := s.db.WithContext(ctx).
		Model(&models.Session{}).
		Where("refresh_token = ?", req.RefreshToken).
		Update("is_revoked", true)

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("session not found")
	}

	return nil
}

func (s *SessionService) DeleteSession(ctx context.Context, req requests.RefreshTokenRequest) error {
	if req.RefreshToken == "" {
		return errors.New("refresh token is required")
	}

	result := s.db.WithContext(ctx).
		Where("refresh_token = ?", req.RefreshToken).
		Delete(&models.Session{})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("session not found")
	}

	return nil
}

func (s *SessionService) CleanupExpiredSessions(ctx context.Context) (int64, error) {
	result := s.db.WithContext(ctx).
		Where("expires_at < ? OR is_revoked = ?", time.Now(), true).
		Delete(&models.Session{})

	if result.Error != nil {
		return 0, result.Error
	}

	return result.RowsAffected, nil
}

func (s *SessionService) GetUserSessions(ctx context.Context, userID uint) ([]models.Session, error) {
	var sessions []models.Session
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND is_revoked = ? AND expires_at > ?", userID, false, time.Now()).
		Find(&sessions).Error

	if err != nil {
		return nil, err
	}

	return sessions, nil
}

func (s *SessionService) RotateSession(ctx context.Context, oldSession *models.Session, newSession models.Session) (*models.Session, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(oldSession).Update("is_revoked", true).Error; err != nil {
			return err
		}

		if err := tx.Create(&newSession).Error; err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return &newSession, nil
}

func (s *SessionService) RevokeSessionFamily(ctx context.Context, tokenFamily string) error {
	result := s.db.WithContext(ctx).
		Model(&models.Session{}).
		Where("token_family = ?", tokenFamily).
		Update("is_revoked", true)

	return result.Error
}

func (s *SessionService) RevokeAllUserSessions(ctx context.Context, userID uint) error {
	result := s.db.WithContext(ctx).
		Model(&models.Session{}).
		Where("user_id = ?", userID).
		Update("is_revoked", true)

	return result.Error
}
