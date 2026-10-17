package responses

import (
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

const (
	oauthInvalidClient    = "invalid_client"
	oauthBasicChallenge   = `Basic realm="monexa"`
	oauthNoStore          = "no-store"
	oauthPragmaNoCache    = "no-cache"
	oauthPragmaHeader     = "Pragma"
	oauthPublicCacheValue = "public, max-age=%d"
)

type oauthErrorBody struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description,omitempty"`
}

// OAuthJSON writes an OAuth protocol JSON response that clients and proxies must not cache.
func OAuthJSON(c echo.Context, status int, body any) error {
	setNoStore(c)
	return c.JSON(status, body)
}

// OAuthError writes an RFC 6749 error response; the description is omitted when empty.
func OAuthError(c echo.Context, status int, code, description string) error {
	return OAuthJSON(c, status, oauthErrorBody{Error: code, ErrorDescription: description})
}

// OAuthInvalidClient rejects client authentication with 401, adding the HTTP Basic challenge when challengeBasic is set.
func OAuthInvalidClient(c echo.Context, description string, challengeBasic bool) error {
	if challengeBasic {
		c.Response().Header().Set(echo.HeaderWWWAuthenticate, oauthBasicChallenge)
	}
	return OAuthError(c, http.StatusUnauthorized, oauthInvalidClient, description)
}

// OAuthRedirect sends an uncacheable 302 to the given location.
func OAuthRedirect(c echo.Context, location string) error {
	setNoStore(c)
	return c.Redirect(http.StatusFound, location)
}

// OAuthNoContent writes an uncacheable response with an empty body.
func OAuthNoContent(c echo.Context, status int) error {
	setNoStore(c)
	return c.NoContent(status)
}

// OAuthText writes an uncacheable plain-text response for endpoints that browsers navigate to.
func OAuthText(c echo.Context, status int, text string) error {
	setNoStore(c)
	return c.String(status, text)
}

// OAuthPublicJSON writes a JSON document that any client or proxy may cache for maxAge.
func OAuthPublicJSON(c echo.Context, maxAge time.Duration, body any) error {
	c.Response().Header().Set(echo.HeaderCacheControl, fmt.Sprintf(oauthPublicCacheValue, int(maxAge.Seconds())))
	return c.JSON(http.StatusOK, body)
}

func setNoStore(c echo.Context) {
	header := c.Response().Header()
	header.Set(echo.HeaderCacheControl, oauthNoStore)
	header.Set(oauthPragmaHeader, oauthPragmaNoCache)
}
