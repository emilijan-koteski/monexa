package middlewares

import (
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/token"
	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

var exemptPaths = map[string]bool{
	"/api/v1/users/data/export": true,
}

func LegalComplianceMiddleware(legalDocumentService *services.LegalDocumentService) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if exemptPaths[c.Path()] {
				return next(c)
			}

			claims := extractClaims(c)
			if claims == nil {
				return next(c)
			}

			latestEffective, err := legalDocumentService.GetLatestEffectiveAt(c.Request().Context())
			if err != nil || latestEffective == nil {
				return next(c)
			}

			if claims.LegalAcceptedAt != nil && !claims.LegalAcceptedAt.Before(*latestEffective) {
				return next(c)
			}

			hasPending, err := legalDocumentService.HasPendingDocuments(c.Request().Context(), claims.UserID)
			if err != nil {
				return next(c)
			}

			if hasPending {
				return responses.LegalAcceptanceRequired(c)
			}

			return next(c)
		}
	}
}

func extractClaims(c echo.Context) *token.UserClaims {
	userToken, ok := c.Get("user").(*jwt.Token)
	if !ok || userToken == nil {
		return nil
	}
	claims, ok := userToken.Claims.(*token.UserClaims)
	if !ok {
		return nil
	}
	return claims
}
