package token

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type TokenType string

const (
	TokenTypeAccess  TokenType = "access"
	TokenTypeRefresh TokenType = "refresh"
)

type UserClaims struct {
	UserID          uint       `json:"userId"`
	TokenType       TokenType  `json:"tokenType"`
	LegalAcceptedAt *time.Time `json:"legalAcceptedAt,omitempty"`
	jwt.RegisteredClaims
}

type RefreshClaims struct {
	UserID    uint      `json:"userId"`
	TokenType TokenType `json:"tokenType"`
	jwt.RegisteredClaims
}

func NewUserClaims(userID uint, ppid string, duration time.Duration, tokenType TokenType, legalAcceptedAt *time.Time) (*UserClaims, error) {
	tokenID, err := uuid.NewRandom()
	if err != nil {
		return nil, fmt.Errorf("error generating token id: %w", err)
	}
	now := time.Now()

	return &UserClaims{
		UserID:          userID,
		TokenType:       tokenType,
		LegalAcceptedAt: legalAcceptedAt,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID.String(),
			Subject:   ppid,
			Issuer:    "monexa",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
		},
	}, nil
}

func NewRefreshClaims(userID uint, ppid string, duration time.Duration) (*RefreshClaims, error) {
	tokenID, err := uuid.NewRandom()
	if err != nil {
		return nil, fmt.Errorf("error generating token id: %w", err)
	}
	now := time.Now()

	return &RefreshClaims{
		UserID:    userID,
		TokenType: TokenTypeRefresh,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID.String(),
			Subject:   ppid,
			Issuer:    "monexa",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
		},
	}, nil
}
