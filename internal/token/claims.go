package token

import (
	"fmt"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
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
	Email           string     `json:"email"`
	Name            string     `json:"name"`
	TokenType       TokenType  `json:"tokenType"`
	LegalAcceptedAt *time.Time `json:"legalAcceptedAt,omitempty"`
	jwt.RegisteredClaims
}

func NewUserClaims(user models.User, duration time.Duration, tokenType TokenType, legalAcceptedAt *time.Time) (*UserClaims, error) {
	tokenID, err := uuid.NewRandom()
	if err != nil {
		return nil, fmt.Errorf("error generating token id: %w", err)
	}
	now := time.Now()

	return &UserClaims{
		UserID:          user.ID,
		Email:           user.Email,
		Name:            user.Name,
		TokenType:       tokenType,
		LegalAcceptedAt: legalAcceptedAt,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID.String(),
			Subject:   user.Email,
			Issuer:    "monexa",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
		},
	}, nil
}
