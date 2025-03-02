package services

import (
	"context"
	"errors"
	"github.com/emilijan-koteski/monexa/internal/models"
	"gorm.io/gorm"
	"time"
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
	if example.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("expiration time must be in the future")
	}

	if err := s.db.WithContext(ctx).Create(&example).Error; err != nil {
		return nil, err
	}

	return &example, nil
}

func (s *SessionService) RevokeSession(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("id is required")
	}

	result := s.db.WithContext(ctx).
		Model(&models.Session{}).
		Where("id = ?", id).
		Update("is_revoked", true)

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("session not found")
	}

	return nil
}

func (s *SessionService) DeleteSession(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("id is required")
	}

	result := s.db.WithContext(ctx).
		Where("id = ?", id).
		Delete(&models.Session{})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("session not found")
	}

	return nil
}
