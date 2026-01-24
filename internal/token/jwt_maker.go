package token

import (
	"fmt"
	"os"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/golang-jwt/jwt/v5"
)

const (
	DefaultAccessTokenDuration  = 7 * 24 * time.Hour  // 7 days
	DefaultRefreshTokenDuration = 30 * 24 * time.Hour // 30 days
)

type JWTMaker struct {
	secretKey            string
	accessTokenDuration  time.Duration
	refreshTokenDuration time.Duration
}

func NewJWTMaker() *JWTMaker {
	secretKey := os.Getenv("JWT_SECRET")

	accessDuration := DefaultAccessTokenDuration
	refreshDuration := DefaultRefreshTokenDuration

	if envAccess := os.Getenv("ACCESS_TOKEN_DURATION"); envAccess != "" {
		if parsed, err := time.ParseDuration(envAccess); err == nil {
			accessDuration = parsed
		}
	}

	if envRefresh := os.Getenv("REFRESH_TOKEN_DURATION"); envRefresh != "" {
		if parsed, err := time.ParseDuration(envRefresh); err == nil {
			refreshDuration = parsed
		}
	}

	return &JWTMaker{
		secretKey:            secretKey,
		accessTokenDuration:  accessDuration,
		refreshTokenDuration: refreshDuration,
	}
}

func (maker *JWTMaker) GetAccessTokenDuration() time.Duration {
	return maker.accessTokenDuration
}

func (maker *JWTMaker) GetRefreshTokenDuration() time.Duration {
	return maker.refreshTokenDuration
}

func (maker *JWTMaker) CreateAccessToken(user models.User) (string, *UserClaims, error) {
	return maker.createToken(user, maker.accessTokenDuration, TokenTypeAccess)
}

func (maker *JWTMaker) CreateRefreshToken(user models.User) (string, *UserClaims, error) {
	return maker.createToken(user, maker.refreshTokenDuration, TokenTypeRefresh)
}

func (maker *JWTMaker) createToken(user models.User, duration time.Duration, tokenType TokenType) (string, *UserClaims, error) {
	claims, err := NewUserClaims(user, duration, tokenType)
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

func (maker *JWTMaker) VerifyAccessToken(tokenString string) (*UserClaims, error) {
	claims, err := maker.VerifyToken(tokenString)
	if err != nil {
		return nil, err
	}
	if claims.TokenType != TokenTypeAccess {
		return nil, fmt.Errorf("invalid token type: expected access token")
	}
	return claims, nil
}

func (maker *JWTMaker) VerifyRefreshToken(tokenString string) (*UserClaims, error) {
	claims, err := maker.VerifyToken(tokenString)
	if err != nil {
		return nil, err
	}
	if claims.TokenType != TokenTypeRefresh {
		return nil, fmt.Errorf("invalid token type: expected refresh token")
	}
	return claims, nil
}
