package server

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

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

type requestLogEntry struct {
	Time         string `json:"time"`
	ID           string `json:"id"`
	RemoteIP     string `json:"remote_ip"`
	Host         string `json:"host"`
	Method       string `json:"method"`
	Path         string `json:"path"`
	UserAgent    string `json:"user_agent"`
	Status       int    `json:"status"`
	Error        string `json:"error"`
	Latency      int64  `json:"latency"`
	LatencyHuman string `json:"latency_human"`
	BytesIn      int64  `json:"bytes_in"`
	BytesOut     int64  `json:"bytes_out"`
}

// RequestLogger writes one JSON line per request with the path but never the query string, and skips the OAuth
// protocol endpoints entirely, keeping search text, codes, state and tokens out of the logs.
func RequestLogger() echo.MiddlewareFunc {
	return middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		Skipper:          skipRequestLog,
		HandleError:      true,
		LogLatency:       true,
		LogRemoteIP:      true,
		LogHost:          true,
		LogMethod:        true,
		LogURIPath:       true,
		LogRequestID:     true,
		LogUserAgent:     true,
		LogStatus:        true,
		LogError:         true,
		LogContentLength: true,
		LogResponseSize:  true,
		LogValuesFunc:    writeRequestLog,
	})
}

func writeRequestLog(c echo.Context, v middleware.RequestLoggerValues) error {
	entry := requestLogEntry{
		Time:         time.Now().Format(time.RFC3339Nano),
		ID:           v.RequestID,
		RemoteIP:     v.RemoteIP,
		Host:         v.Host,
		Method:       v.Method,
		Path:         v.URIPath,
		UserAgent:    v.UserAgent,
		Status:       v.Status,
		Latency:      int64(v.Latency),
		LatencyHuman: v.Latency.String(),
		BytesIn:      parseContentLength(v.ContentLength),
		BytesOut:     v.ResponseSize,
	}
	if v.Error != nil {
		entry.Error = v.Error.Error()
	}
	return json.NewEncoder(c.Logger().Output()).Encode(entry)
}

func parseContentLength(header string) int64 {
	length, err := strconv.ParseInt(header, 10, 64)
	if err != nil {
		return 0
	}
	return length
}

func skipRequestLog(c echo.Context) bool {
	return strings.HasPrefix(c.Request().URL.Path, oauthPathPrefix)
}
