package token

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	DefaultAccessTokenDuration  = 7 * 24 * time.Hour
	DefaultRefreshTokenDuration = 30 * 24 * time.Hour

	DelegatedAccessTokenDuration = 5 * time.Minute
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

func (maker *JWTMaker) CreateAccessToken(userID uint, ppid string, legalAcceptedAt *time.Time) (string, *UserClaims, error) {
	claims, err := NewUserClaims(userID, ppid, maker.accessTokenDuration, TokenTypeAccess, legalAcceptedAt)
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

// CreateDelegatedAccessToken mints a short-lived access token for an AI agent acting on behalf of the user.
// It expires after DelegatedAccessTokenDuration or at notAfter, whichever comes first.
func (maker *JWTMaker) CreateDelegatedAccessToken(userID uint, ppid string, legalAcceptedAt *time.Time, scope, clientID, grantID string, notAfter time.Time) (string, *UserClaims, error) {
	if grantID == "" {
		return "", nil, fmt.Errorf("delegated token requires a grant id")
	}
	now := time.Now()
	if !notAfter.After(now) {
		return "", nil, fmt.Errorf("delegated token notAfter must be in the future")
	}
	expiresAt := now.Add(DelegatedAccessTokenDuration)
	if notAfter.Before(expiresAt) {
		expiresAt = notAfter
	}

	claims, err := NewUserClaims(userID, ppid, DelegatedAccessTokenDuration, TokenTypeAccess, legalAcceptedAt)
	if err != nil {
		return "", nil, err
	}
	claims.Scope = scope
	claims.ClientID = clientID
	claims.GrantID = grantID
	claims.ExpiresAt = jwt.NewNumericDate(expiresAt)

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(maker.secretKey))
	if err != nil {
		return "", nil, fmt.Errorf("error signing token: %w", err)
	}

	return tokenString, claims, nil
}

func (maker *JWTMaker) CreateRefreshToken(userID uint, ppid string) (string, *RefreshClaims, error) {
	claims, err := NewRefreshClaims(userID, ppid, maker.refreshTokenDuration)
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

func (maker *JWTMaker) VerifyRefreshToken(tokenString string) (*RefreshClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &RefreshClaims{}, func(token *jwt.Token) (interface{}, error) {
		_, ok := token.Method.(*jwt.SigningMethodHMAC)
		if !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(maker.secretKey), nil
	})
	if err != nil {
		return nil, fmt.Errorf("error parsing token: %w", err)
	}

	claims, ok := token.Claims.(*RefreshClaims)
	if !ok {
		return nil, fmt.Errorf("error parsing token claims")
	}
	if claims.TokenType != TokenTypeRefresh {
		return nil, fmt.Errorf("invalid token type: expected refresh token")
	}
	return claims, nil
}
