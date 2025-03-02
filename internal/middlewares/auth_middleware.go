package middlewares

import (
	"fmt"
	"github.com/emilijan-koteski/monexa/internal/token"
	"github.com/golang-jwt/jwt/v5"
	echojwt "github.com/labstack/echo-jwt/v4"
	"github.com/labstack/echo/v4"
	"os"
)

func AuthMiddleware() echo.MiddlewareFunc {
	secretKey := os.Getenv("JWT_SECRET")

	config := echojwt.Config{
		SigningKey: []byte(secretKey),
		NewClaimsFunc: func(c echo.Context) jwt.Claims {
			return &token.UserClaims{}
		},
	}

	return echojwt.WithConfig(config)
}

func GetUserClaims(c echo.Context) (*token.UserClaims, error) {
	user := c.Get("user").(*jwt.Token)
	if user == nil {
		return nil, fmt.Errorf("token not found in context")
	}

	claims, ok := user.Claims.(*token.UserClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}
