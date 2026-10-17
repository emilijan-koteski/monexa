package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	dtoResponses "github.com/emilijan-koteski/monexa/internal/responses"
	"github.com/emilijan-koteski/monexa/internal/server"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"
)

const (
	oauthMetadataPath  = "/.well-known/oauth-authorization-server"
	oauthGroupPath     = "/oauth"
	oauthAuthorizePath = "/authorize"
	oauthTokenPath     = "/token"
	oauthRegisterPath  = "/register"
	oauthRevokePath    = "/revoke"
	oauthErrorPagePath = "/oauth/error"

	oauthBodyLimit      = "16K"
	oauthMetadataMaxAge = time.Hour
	oauthFormContextKey = "oauthForm"
	mcpClientContextKey = "oauthMCPClientAuthentication"

	authorizeRequestsPerMinute        = 20
	registerRequestsPerHour           = 100
	registerBurst                     = 20
	publicClientRequestsPerMinute     = 120
	tokenIPRequestsPerMinute          = 600
	failedClientAuthRequestsPerMinute = 20

	grantTypeAuthorizationCode = "authorization_code"
	grantTypeRefreshToken      = "refresh_token"
	grantTypeTokenExchange     = "urn:ietf:params:oauth:grant-type:token-exchange"
	tokenTypeAccessToken       = "urn:ietf:params:oauth:token-type:access_token"
	responseTypeCode           = "code"
	responseModeQuery          = "query"
	codeChallengeMethodS256    = "S256"
	authMethodNone             = "none"

	paramGrantType           = "grant_type"
	paramClientID            = "client_id"
	paramCode                = "code"
	paramRedirectURI         = "redirect_uri"
	paramCodeVerifier        = "code_verifier"
	paramResource            = "resource"
	paramRefreshToken        = "refresh_token"
	paramScope               = "scope"
	paramSubjectToken        = "subject_token"
	paramSubjectTokenType    = "subject_token_type"
	paramToken               = "token"
	paramResponseType        = "response_type"
	paramState               = "state"
	paramCodeChallenge       = "code_challenge"
	paramCodeChallengeMethod = "code_challenge_method"

	oauthErrInvalidRequest        = "invalid_request"
	oauthErrInvalidGrant          = "invalid_grant"
	oauthErrInvalidScope          = "invalid_scope"
	oauthErrInvalidTarget         = "invalid_target"
	oauthErrUnsupportedGrantType  = "unsupported_grant_type"
	oauthErrInvalidRedirectURI    = "invalid_redirect_uri"
	oauthErrInvalidClientMetadata = "invalid_client_metadata"
	oauthErrServerError           = "server_error"
	oauthErrRateLimited           = "rate_limited"

	publicClientKeySeparator = "|"
	retryAfterHeader         = "Retry-After"
	authorizeRateLimitedText = "Too many authorization requests. Please try again shortly."
)

var (
	errOAuthFormContentType = errors.New("content type is not application/x-www-form-urlencoded")
	errOAuthFormRepeated    = errors.New("a form parameter is repeated")

	authorizeParameterNames = []string{
		paramResponseType, paramClientID, paramRedirectURI, paramScope, paramState,
		paramCodeChallenge, paramCodeChallengeMethod, paramResource,
	}
	untrustedAuthorizeParameterNames = []string{paramClientID, paramRedirectURI}
	defaultRegistrationGrantTypes    = []string{grantTypeAuthorizationCode, grantTypeRefreshToken}
	defaultRegistrationResponseTypes = []string{responseTypeCode}

	authorizeRateLimit        = rateLimit{requests: authorizeRequestsPerMinute, window: time.Minute, burst: authorizeRequestsPerMinute}
	registerRateLimit         = rateLimit{requests: registerRequestsPerHour, window: time.Hour, burst: registerBurst}
	publicClientRateLimit     = rateLimit{requests: publicClientRequestsPerMinute, window: time.Minute, burst: publicClientRequestsPerMinute}
	tokenIPRateLimit          = rateLimit{requests: tokenIPRequestsPerMinute, window: time.Minute, burst: tokenIPRequestsPerMinute}
	failedClientAuthRateLimit = rateLimit{requests: failedClientAuthRequestsPerMinute, window: time.Minute, burst: failedClientAuthRequestsPerMinute}
)

type oauthHandler struct {
	metadata             dtoResponses.OAuthServerMetadataResponse
	errorPageURL         string
	clientService        *services.OAuthClientService
	authorizationService *services.OAuthAuthorizationService
	tokenService         *services.OAuthTokenService
}

type oauthFormResult struct {
	values url.Values
	err    error
}

type mcpClientAuthentication struct {
	clientID      string
	authenticated bool
}

type rateLimit struct {
	requests int
	window   time.Duration
	burst    int
}

type rateLimiter struct {
	limit rateLimit
	store *middleware.RateLimiterMemoryStore
}

type clientRateLimiters struct {
	publicClient     *rateLimiter
	clientIP         *rateLimiter
	failedClientAuth *rateLimiter
}

// RegisterOAuthHandler registers the RFC 8414 metadata document and the OAuth endpoints under /oauth.
// These endpoints answer with RFC 6749 errors instead of the API response envelope.
func RegisterOAuthHandler(
	e *echo.Echo,
	cfg *server.OAuthConfig,
	frontendURL string,
	clientService *services.OAuthClientService,
	authorizationService *services.OAuthAuthorizationService,
	tokenService *services.OAuthTokenService,
) {
	handler := &oauthHandler{
		metadata:             newOAuthServerMetadata(cfg.IssuerURL),
		errorPageURL:         strings.TrimSuffix(frontendURL, "/") + oauthErrorPagePath,
		clientService:        clientService,
		authorizationService: authorizationService,
		tokenService:         tokenService,
	}

	e.GET(oauthMetadataPath, handler.Metadata)

	oauth := e.Group(oauthGroupPath, convertBodyTooLarge, middleware.BodyLimit(oauthBodyLimit))

	oauth.GET(oauthAuthorizePath, handler.Authorize, limitPerIP(newRateLimiter(authorizeRateLimit), denyAuthorizeRateLimited))
	oauth.POST(oauthTokenPath, handler.Token, handler.limitClients())
	oauth.POST(oauthRegisterPath, handler.Register, limitPerIP(newRateLimiter(registerRateLimit), denyRateLimited))
	oauth.POST(oauthRevokePath, handler.Revoke, handler.limitClients())
}

func (h *oauthHandler) Metadata(c echo.Context) error {
	return responses.OAuthPublicJSON(c, oauthMetadataMaxAge, h.metadata)
}

// Authorize starts an authorization request and redirects to the consent page, to the client with an error, or,
// while the client or redirect_uri is not yet trusted, to the frontend error page.
func (h *oauthHandler) Authorize(c echo.Context) error {
	query := c.QueryParams()
	if name := firstRepeated(query, untrustedAuthorizeParameterNames); name != "" {
		return h.redirectToErrorPage(c, oauthErrInvalidRequest, name+" must not be repeated")
	}

	result, err := h.authorizationService.Start(c.Request().Context(), authorizeParams(query))
	if err == nil {
		return responses.OAuthRedirect(c, result.ConsentURL)
	}
	var clientRedirect *services.OAuthRedirectError
	if errors.As(err, &clientRedirect) {
		return responses.OAuthRedirect(c, clientRedirect.RedirectURL)
	}
	var noRedirect *services.OAuthNoRedirectError
	if errors.As(err, &noRedirect) {
		return h.redirectToErrorPage(c, noRedirect.Code, noRedirect.Description)
	}
	log.Printf("oauth: authorization request failed: %v", err)
	return h.redirectToErrorPage(c, oauthErrServerError, "the authorization request could not be processed")
}

func (h *oauthHandler) Token(c echo.Context) error {
	form, err := oauthForm(c)
	if err != nil {
		return respondFormError(c, err)
	}

	switch form.Get(paramGrantType) {
	case grantTypeAuthorizationCode:
		return h.exchangeAuthorizationCode(c, form)
	case grantTypeRefreshToken:
		return h.refreshAccessToken(c, form)
	case grantTypeTokenExchange:
		return h.exchangeForDelegatedToken(c, form)
	case "":
		return respondMissingParameter(c, paramGrantType)
	default:
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrUnsupportedGrantType, "the grant type is not supported")
	}
}

// Register performs RFC 7591 dynamic registration of a public client. The body is read in full first because a
// JSON decoder drops the body limit's error when the oversized read also completes the document.
func (h *oauthHandler) Register(c echo.Context) error {
	if !hasMediaType(c.Request(), echo.MIMEApplicationJSON) {
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidClientMetadata, "the content type must be application/json")
	}
	body, err := io.ReadAll(c.Request().Body)
	if errors.Is(err, echo.ErrStatusRequestEntityTooLarge) {
		return respondBodyTooLarge(c)
	}
	var metadata requests.OAuthClientRegistrationRequest
	if err != nil || json.Unmarshal(body, &metadata) != nil {
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidClientMetadata, "the request body is not a valid client metadata document")
	}

	client, err := h.clientService.Register(c.Request().Context(), metadata)
	switch {
	case err == nil:
		return responses.OAuthJSON(c, http.StatusCreated, newClientRegistrationResponse(client, metadata))
	case errors.Is(err, services.ErrOAuthInvalidRedirectURI):
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidRedirectURI, "redirect_uris must list one to five https or loopback http URIs")
	case errors.Is(err, services.ErrOAuthInvalidRequest):
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidClientMetadata, "the client metadata is invalid or not supported")
	default:
		return respondServerError(c, "client registration", err)
	}
}

// Revoke implements RFC 7009: unknown tokens and other clients' tokens are answered with 200 like revoked ones.
func (h *oauthHandler) Revoke(c echo.Context) error {
	form, err := oauthForm(c)
	if err != nil {
		return respondFormError(c, err)
	}
	if name := firstMissing(form, paramToken, paramClientID); name != "" {
		return respondMissingParameter(c, name)
	}

	if err := h.tokenService.RevokeToken(c.Request().Context(), form.Get(paramClientID), form.Get(paramToken)); err != nil {
		return respondServerError(c, "token revocation", err)
	}
	return responses.OAuthNoContent(c, http.StatusOK)
}

func (h *oauthHandler) exchangeAuthorizationCode(c echo.Context, form url.Values) error {
	if hasAuthorizationHeader(c.Request()) {
		return rejectPublicClientCredentials(c)
	}
	if name := firstMissing(form, paramCode, paramRedirectURI, paramCodeVerifier, paramClientID); name != "" {
		return respondMissingParameter(c, name)
	}

	issued, err := h.tokenService.ExchangeCode(c.Request().Context(), form.Get(paramClientID), form.Get(paramCode),
		form.Get(paramRedirectURI), form.Get(paramCodeVerifier), form.Get(paramResource))
	return respondTokenResult(c, grantTypeAuthorizationCode, form.Get(paramClientID), issued, err)
}

func (h *oauthHandler) refreshAccessToken(c echo.Context, form url.Values) error {
	if hasAuthorizationHeader(c.Request()) {
		return rejectPublicClientCredentials(c)
	}
	if name := firstMissing(form, paramRefreshToken, paramClientID); name != "" {
		return respondMissingParameter(c, name)
	}

	issued, err := h.tokenService.Refresh(c.Request().Context(), form.Get(paramClientID), form.Get(paramRefreshToken),
		form.Get(paramScope), form.Get(paramResource))
	return respondTokenResult(c, grantTypeRefreshToken, form.Get(paramClientID), issued, err)
}

// exchangeForDelegatedToken serves the MCP server's RFC 8693 token exchange. HTTP Basic is the only accepted client
// authentication there, so every 401 carries the Basic challenge.
func (h *oauthHandler) exchangeForDelegatedToken(c echo.Context, form url.Values) error {
	client := h.authenticateMCPClient(c)
	if !client.authenticated {
		return responses.OAuthInvalidClient(c, "client authentication failed", true)
	}
	if formClientID := form.Get(paramClientID); formClientID != "" && formClientID != client.clientID {
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidRequest, "client_id does not match the authenticated client")
	}
	if name := firstMissing(form, paramSubjectToken, paramSubjectTokenType, paramResource); name != "" {
		return respondMissingParameter(c, name)
	}
	if form.Get(paramSubjectTokenType) != tokenTypeAccessToken {
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidRequest, "subject_token_type must be "+tokenTypeAccessToken)
	}

	issued, err := h.tokenService.ExchangeForDelegatedToken(c.Request().Context(), form.Get(paramSubjectToken), form.Get(paramResource))
	return respondTokenResult(c, grantTypeTokenExchange, client.clientID, issued, err)
}

// authenticateMCPClient checks the request's Basic credentials against the MCP client once per request and caches
// the outcome, so the rate limiter and the handler share one check.
func (h *oauthHandler) authenticateMCPClient(c echo.Context) mcpClientAuthentication {
	if cached, ok := c.Get(mcpClientContextKey).(mcpClientAuthentication); ok {
		return cached
	}
	clientID, secret, ok := basicClientCredentials(c.Request())
	result := mcpClientAuthentication{clientID: clientID, authenticated: ok && h.tokenService.AuthenticateMCPClient(clientID, secret)}
	c.Set(mcpClientContextKey, result)
	return result
}

// limitClients guards /token and /revoke: the authenticated MCP client is exempt, failed Basic attempts share a
// per-IP bucket, and public clients are limited per client_id and IP under a coarse per-IP cap.
func (h *oauthHandler) limitClients() echo.MiddlewareFunc {
	limiters := clientRateLimiters{
		publicClient:     newRateLimiter(publicClientRateLimit),
		clientIP:         newRateLimiter(tokenIPRateLimit),
		failedClientAuth: newRateLimiter(failedClientAuthRateLimit),
	}
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if retryAfter, exceeded := h.clientLimitExceeded(c, limiters); exceeded {
				return denyRateLimited(c, retryAfter)
			}
			return next(c)
		}
	}
}

// clientLimitExceeded takes the request from its buckets; the form client_id never overrides Basic credentials.
func (h *oauthHandler) clientLimitExceeded(c echo.Context, limiters clientRateLimiters) (time.Duration, bool) {
	ip := c.RealIP()
	if attemptedBasicAuth(c.Request()) {
		if h.authenticateMCPClient(c).authenticated {
			return 0, false
		}
		return limiters.failedClientAuth.take(ip)
	}
	if retryAfter, exceeded := limiters.clientIP.take(ip); exceeded {
		return retryAfter, true
	}
	return limiters.publicClient.take(publicClientKey(c, ip))
}

func (h *oauthHandler) redirectToErrorPage(c echo.Context, code, description string) error {
	query := url.Values{"error": {code}, "error_description": {description}}
	return responses.OAuthRedirect(c, h.errorPageURL+"?"+query.Encode())
}

func newOAuthServerMetadata(issuer string) dtoResponses.OAuthServerMetadataResponse {
	endpoint := func(path string) string { return issuer + oauthGroupPath + path }
	return dtoResponses.OAuthServerMetadataResponse{
		Issuer:                                 issuer,
		AuthorizationEndpoint:                  endpoint(oauthAuthorizePath),
		TokenEndpoint:                          endpoint(oauthTokenPath),
		RegistrationEndpoint:                   endpoint(oauthRegisterPath),
		RevocationEndpoint:                     endpoint(oauthRevokePath),
		ResponseTypesSupported:                 []string{responseTypeCode},
		ResponseModesSupported:                 []string{responseModeQuery},
		GrantTypesSupported:                    []string{grantTypeAuthorizationCode, grantTypeRefreshToken},
		TokenEndpointAuthMethodsSupported:      []string{authMethodNone},
		RevocationEndpointAuthMethodsSupported: []string{authMethodNone},
		CodeChallengeMethodsSupported:          []string{codeChallengeMethodS256},
		ScopesSupported: []string{
			string(types.ScopeRead), string(types.ScopeWrite), string(types.ScopeOfflineAccess),
		},
		ClientIDMetadataDocumentSupported:          true,
		AuthorizationResponseIssParameterSupported: true,
	}
}

func newClientRegistrationResponse(client *models.OAuthClient, metadata requests.OAuthClientRegistrationRequest) dtoResponses.OAuthClientRegistrationResponse {
	return dtoResponses.OAuthClientRegistrationResponse{
		ClientID:                client.ID,
		ClientIDIssuedAt:        client.CreatedAt.Unix(),
		ClientName:              client.Name,
		RedirectURIs:            client.RedirectURIs,
		GrantTypes:              valuesOrDefault(metadata.GrantTypes, defaultRegistrationGrantTypes),
		ResponseTypes:           valuesOrDefault(metadata.ResponseTypes, defaultRegistrationResponseTypes),
		TokenEndpointAuthMethod: authMethodNone,
	}
}

func authorizeParams(query url.Values) requests.OAuthAuthorizeParams {
	return requests.OAuthAuthorizeParams{
		ResponseType:        query.Get(paramResponseType),
		ClientID:            query.Get(paramClientID),
		RedirectURI:         query.Get(paramRedirectURI),
		Scope:               query.Get(paramScope),
		State:               singleValue(query, paramState),
		CodeChallenge:       query.Get(paramCodeChallenge),
		CodeChallengeMethod: query.Get(paramCodeChallengeMethod),
		Resource:            query.Get(paramResource),
		RepeatedParameter:   firstRepeated(query, authorizeParameterNames),
	}
}

// oauthForm parses the request's form body once and caches the outcome, so the rate limiter and the handler
// read the same values and a parse error is never lost.
func oauthForm(c echo.Context) (url.Values, error) {
	if parsed, ok := c.Get(oauthFormContextKey).(oauthFormResult); ok {
		return parsed.values, parsed.err
	}
	values, err := parseOAuthForm(c.Request())
	c.Set(oauthFormContextKey, oauthFormResult{values: values, err: err})
	return values, err
}

// parseOAuthForm reads only the urlencoded body, never the query string, and rejects repeated parameters.
func parseOAuthForm(r *http.Request) (url.Values, error) {
	if !hasMediaType(r, echo.MIMEApplicationForm) {
		return nil, errOAuthFormContentType
	}
	if err := r.ParseForm(); err != nil {
		return nil, err
	}
	for _, values := range r.PostForm {
		if len(values) > 1 {
			return nil, errOAuthFormRepeated
		}
	}
	return r.PostForm, nil
}

func hasMediaType(r *http.Request, want string) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get(echo.HeaderContentType))
	return err == nil && mediaType == want
}

func firstMissing(values url.Values, names ...string) string {
	for _, name := range names {
		if values.Get(name) == "" {
			return name
		}
	}
	return ""
}

func firstRepeated(values url.Values, names []string) string {
	for _, name := range names {
		if len(values[name]) > 1 {
			return name
		}
	}
	return ""
}

func singleValue(values url.Values, name string) *string {
	if len(values[name]) != 1 {
		return nil
	}
	return &values[name][0]
}

func valuesOrDefault(values, fallback []string) []string {
	if len(values) == 0 {
		return fallback
	}
	return values
}

func hasAuthorizationHeader(r *http.Request) bool {
	return r.Header.Get(echo.HeaderAuthorization) != ""
}

func attemptedBasicAuth(r *http.Request) bool {
	scheme, _, _ := strings.Cut(r.Header.Get(echo.HeaderAuthorization), " ")
	return strings.EqualFold(scheme, "Basic")
}

// basicClientCredentials returns the HTTP Basic client credentials, form-decoded as RFC 6749 section 2.3.1 requires.
func basicClientCredentials(r *http.Request) (string, string, bool) {
	username, password, ok := r.BasicAuth()
	if !ok {
		return "", "", false
	}
	clientID, clientIDErr := url.QueryUnescape(username)
	secret, secretErr := url.QueryUnescape(password)
	if clientIDErr != nil || secretErr != nil || clientID == "" {
		return "", "", false
	}
	return clientID, secret, true
}

func rejectPublicClientCredentials(c echo.Context) error {
	return responses.OAuthInvalidClient(c, "this grant type does not accept client credentials", attemptedBasicAuth(c.Request()))
}

// respondTokenResult logs why a token request failed, never with a token value, and answers with the tokens or a fixed error.
func respondTokenResult(c echo.Context, grantType, clientID string, issued *dtoResponses.OAuthTokenResponse, err error) error {
	if err != nil {
		log.Printf("oauth: %s request from client %q failed: %v", grantType, clientID, err)
		return respondTokenError(c, err)
	}
	return responses.OAuthJSON(c, http.StatusOK, issued)
}

// respondTokenError maps token service errors to fixed RFC 6749 responses; the service's reasons never reach the
// client because they would reveal why a token is unusable.
func respondTokenError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, services.ErrOAuthInvalidGrant):
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidGrant, "the authorization grant or token is invalid, expired or revoked")
	case errors.Is(err, services.ErrOAuthInvalidRequest):
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidRequest, "the token request is invalid")
	case errors.Is(err, services.ErrOAuthInvalidScope):
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidScope, "the requested scope is invalid or exceeds the granted scope")
	case errors.Is(err, services.ErrOAuthInvalidTarget):
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidTarget, "the requested resource does not match the grant")
	case errors.Is(err, services.ErrOAuthInvalidClient):
		return responses.OAuthInvalidClient(c, "client authentication failed", false)
	default:
		return respondUnexpectedError(c)
	}
}

func respondFormError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, echo.ErrStatusRequestEntityTooLarge):
		return respondBodyTooLarge(c)
	case errors.Is(err, errOAuthFormContentType):
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidRequest, "the content type must be "+echo.MIMEApplicationForm)
	case errors.Is(err, errOAuthFormRepeated):
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidRequest, "request parameters must not be repeated")
	default:
		return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidRequest, "the request body is not a valid form")
	}
}

func respondMissingParameter(c echo.Context, name string) error {
	return responses.OAuthError(c, http.StatusBadRequest, oauthErrInvalidRequest, name+" is required")
}

func respondBodyTooLarge(c echo.Context) error {
	return responses.OAuthError(c, http.StatusRequestEntityTooLarge, oauthErrInvalidRequest, "the request body is too large")
}

func respondServerError(c echo.Context, operation string, err error) error {
	log.Printf("oauth: %s failed: %v", operation, err)
	return respondUnexpectedError(c)
}

func respondUnexpectedError(c echo.Context) error {
	return responses.OAuthError(c, http.StatusInternalServerError, oauthErrServerError, "the authorization server encountered an unexpected error")
}

// convertBodyTooLarge answers the body limit's 413 with an RFC 6749 error instead of Echo's default body.
func convertBodyTooLarge(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		err := next(c)
		var httpErr *echo.HTTPError
		if errors.As(err, &httpErr) && httpErr.Code == http.StatusRequestEntityTooLarge && !c.Response().Committed {
			return respondBodyTooLarge(c)
		}
		return err
	}
}

func newRateLimiter(limit rateLimit) *rateLimiter {
	return &rateLimiter{
		limit: limit,
		store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      rate.Every(limit.window / time.Duration(limit.requests)),
			Burst:     limit.burst,
			ExpiresIn: limit.window,
		}),
	}
}

// take removes one request from the key's bucket and, when the bucket is empty, reports how long to wait.
func (l *rateLimiter) take(key string) (time.Duration, bool) {
	if allowed, _ := l.store.Allow(key); allowed {
		return 0, false
	}
	return l.limit.retryAfter(), true
}

// retryAfter is the refill interval of one request, rounded up to whole seconds.
func (l rateLimit) retryAfter() time.Duration {
	interval := l.window / time.Duration(l.requests)
	return max(time.Second, (interval + time.Second - 1).Truncate(time.Second))
}

func limitPerIP(limiter *rateLimiter, deny func(echo.Context, time.Duration) error) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if retryAfter, exceeded := limiter.take(c.RealIP()); exceeded {
				return deny(c, retryAfter)
			}
			return next(c)
		}
	}
}

// publicClientKey pairs the hashed client_id with the caller's IP, so no caller can drain a client's budget for
// everyone else and arbitrarily long ids cannot inflate the limiter's memory.
func publicClientKey(c echo.Context, ip string) string {
	var clientID string
	if form, err := oauthForm(c); err == nil {
		clientID = form.Get(paramClientID)
	}
	digest := sha256.Sum256([]byte(clientID))
	return hex.EncodeToString(digest[:]) + publicClientKeySeparator + ip
}

func denyRateLimited(c echo.Context, retryAfter time.Duration) error {
	setRetryAfter(c, retryAfter)
	return responses.OAuthError(c, http.StatusTooManyRequests, oauthErrRateLimited, "")
}

func denyAuthorizeRateLimited(c echo.Context, retryAfter time.Duration) error {
	setRetryAfter(c, retryAfter)
	return responses.OAuthText(c, http.StatusTooManyRequests, authorizeRateLimitedText)
}

func setRetryAfter(c echo.Context, retryAfter time.Duration) {
	c.Response().Header().Set(retryAfterHeader, strconv.Itoa(int(retryAfter/time.Second)))
}
