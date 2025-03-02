package token

import (
	"fmt"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"os"
	"time"
)

type JWTMaker struct {
	secretKey string
}

func NewJWTMaker() *JWTMaker {
	secretKey := os.Getenv("JWT_SECRET")
	return &JWTMaker{secretKey: secretKey}
}

func (maker *JWTMaker) CreateToken(user models.User, duration time.Duration) (string, *UserClaims, error) {
	claims, err := NewUserClaims(user, duration)
	if err != nil {
		return "", nil, err
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(maker.secretKey))
	if err != nil {
		return "", nil, fmt.Errorf("error signing token: %w", err)
	}

	return tokenString, claims, nil
}

func (maker *JWTMaker) VerifyToken(tokenString string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		_, ok := token.Method.(*jwt.SigningMethodHMAC)
		if !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}

		return []byte(maker.secretKey), nil
	})
	if err != nil {
		return nil, fmt.Errorf("error parsing token: %w", err)
	}

	claims, ok := token.Claims.(*UserClaims)
	if !ok {
		return nil, fmt.Errorf("error parsing token claims")
	}

	return claims, nil
}
