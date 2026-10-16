package middlewares

import (
	"fmt"
	"net/http"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/labstack/echo/v4"
)

const delegatedEndpointUnavailableMessage = "this endpoint is not available to connected apps"

var delegatedAllowlist = map[string]bool{
	"GET /api/v1/records":                          true,
	"GET /api/v1/records/:id":                      true,
	"GET /api/v1/records/summary":                  true,
	"GET /api/v1/records/descriptions/suggestions": true,
	"POST /api/v1/records":                         true,
	"PATCH /api/v1/records/:id":                    true,
	"DELETE /api/v1/records/:id":                   true,

	"GET /api/v1/recurring-expenses":        true,
	"GET /api/v1/recurring-expenses/:id":    true,
	"POST /api/v1/recurring-expenses":       true,
	"PATCH /api/v1/recurring-expenses/:id":  true,
	"DELETE /api/v1/recurring-expenses/:id": true,

	"GET /api/v1/payment-methods":        true,
	"GET /api/v1/payment-methods/:id":    true,
	"POST /api/v1/payment-methods":       true,
	"PATCH /api/v1/payment-methods/:id":  true,
	"DELETE /api/v1/payment-methods/:id": true,

	"GET /api/v1/categories":            true,
	"GET /api/v1/categories/:id":        true,
	"GET /api/v1/categories/statistics": true,
	"POST /api/v1/categories":           true,
	"PATCH /api/v1/categories/:id":      true,
	"DELETE /api/v1/categories/:id":     true,

	"GET /api/v1/settings":   true,
	"PATCH /api/v1/settings": true,

	"GET /api/v1/trend-reports":                     true,
	"GET /api/v1/trend-reports/:id":                 true,
	"GET /api/v1/trend-reports/:id/monthly-data":    true,
	"GET /api/v1/trend-reports/:id/monthly-details": true,
	"POST /api/v1/trend-reports":                    true,
	"PATCH /api/v1/trend-reports/:id":               true,
	"DELETE /api/v1/trend-reports/:id":              true,

	"GET /api/v1/users/me": true,
}

// delegatedAccessGuard restricts delegated (AI agent) tokens to an explicit allowlist of routes and scopes.
// Requests authenticated with a normal user token pass through untouched.
func delegatedAccessGuard(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		claims := extractClaims(c)
		if claims == nil {
			return responses.Unauthorized(c)
		}
		if !claims.IsDelegated() {
			return next(c)
		}

		method := c.Request().Method
		if !delegatedAllowlist[fmt.Sprintf("%s %s", method, c.Path())] {
			return responses.ForbiddenWithMessage(c, delegatedEndpointUnavailableMessage)
		}

		required := requiredDelegatedScope(method)
		if !utils.HasScope(claims.Scope, required) {
			return responses.ForbiddenWithMessage(c, fmt.Sprintf("insufficient scope: requires %s", required))
		}

		return next(c)
	}
}

func requiredDelegatedScope(method string) types.OAuthScope {
	if method == http.MethodGet {
		return types.ScopeRead
	}
	return types.ScopeWrite
}
