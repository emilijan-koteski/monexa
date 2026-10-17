package server

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

const (
	wellKnownPathPrefix = "/.well-known/"
	oauthPathPrefix     = "/oauth/"
	publicCORSMaxAge    = 3600
	appCORSMaxAge       = 300
)

var publicOAuthEndpoints = map[string]bool{
	"/oauth/token":    true,
	"/oauth/register": true,
	"/oauth/revoke":   true,
}

// IsPublicOAuthPath reports whether a path is open to every origin without credentials: discovery documents and
// the OAuth endpoints that browser-based clients call directly. /oauth/authorize is a navigation, not a fetch.
func IsPublicOAuthPath(path string) bool {
	return strings.HasPrefix(path, wellKnownPathPrefix) || publicOAuthEndpoints[path]
}

// CORSMiddlewares returns the public OAuth CORS policy and the app's credentialed policy, with complementary
// skippers so exactly one of them handles each request.
func CORSMiddlewares() []echo.MiddlewareFunc {
	return []echo.MiddlewareFunc{
		middleware.CORSWithConfig(middleware.CORSConfig{
			Skipper:      func(c echo.Context) bool { return !IsPublicOAuthPath(c.Request().URL.Path) },
			AllowOrigins: []string{"*"},
			AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions},
			AllowHeaders: []string{"Authorization", "Content-Type", "Accept", "MCP-Protocol-Version"},
			MaxAge:       publicCORSMaxAge,
		}),
		middleware.CORSWithConfig(middleware.CORSConfig{
			Skipper:          func(c echo.Context) bool { return IsPublicOAuthPath(c.Request().URL.Path) },
			AllowOrigins:     CORSOrigins(),
			AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
			AllowHeaders:     []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
			AllowCredentials: true,
			MaxAge:           appCORSMaxAge,
		}),
	}
}

// RequestLogger logs every request except the OAuth protocol endpoints, keeping codes, state and tokens out of the logs.
func RequestLogger() echo.MiddlewareFunc {
	return middleware.LoggerWithConfig(middleware.LoggerConfig{Skipper: skipRequestLog})
}

func skipRequestLog(c echo.Context) bool {
	return strings.HasPrefix(c.Request().URL.Path, oauthPathPrefix)
}
