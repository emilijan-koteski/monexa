package services

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	authorizationIDRandomBytes    = 32
	pendingAuthorizationTTL       = 15 * time.Minute
	authorizationCodeTTL          = 2 * time.Minute
	expiredAuthorizationRetention = 24 * time.Hour
	consentPath                   = "/oauth/consent"
	maxStateLength                = 1024

	responseTypeCode        = "code"
	codeChallengeMethodS256 = "S256"

	oauthErrorInvalidRequest          = "invalid_request"
	oauthErrorInvalidClient           = "invalid_client"
	oauthErrorUnsupportedResponseType = "unsupported_response_type"
	oauthErrorInvalidScope            = "invalid_scope"
	oauthErrorInvalidTarget           = "invalid_target"
	oauthErrorAccessDenied            = "access_denied"
)

var defaultAuthorizationScopes = []types.OAuthScope{types.ScopeRead, types.ScopeWrite}

type OAuthAuthorizeResult struct {
	ConsentURL string
}

type authorizeFailure struct {
	code        string
	description string
}

type OAuthAuthorizationService struct {
	db            *gorm.DB
	clientService *OAuthClientService
	grantService  *OAuthGrantService
	issuer        string
	resource      string
	frontendURL   string
}

func NewOAuthAuthorizationService(db *gorm.DB, clientService *OAuthClientService, grantService *OAuthGrantService, issuer, resource, frontendURL string) *OAuthAuthorizationService {
	return &OAuthAuthorizationService{
		db:            db,
		clientService: clientService,
		grantService:  grantService,
		issuer:        issuer,
		resource:      resource,
		frontendURL:   strings.TrimSuffix(frontendURL, "/"),
	}
}

// Start validates an /authorize request and stores it as a pending authorization awaiting the user's consent.
// Client and redirect_uri failures return *OAuthNoRedirectError; later failures return *OAuthRedirectError.
func (s *OAuthAuthorizationService) Start(ctx context.Context, p requests.OAuthAuthorizeParams) (*OAuthAuthorizeResult, error) {
	client, err := s.resolveClient(ctx, p.ClientID)
	if err != nil {
		return nil, err
	}
	if p.RedirectURI == "" {
		return nil, &OAuthNoRedirectError{Code: oauthErrorInvalidRequest, Description: "redirect_uri is required"}
	}
	if !utils.MatchRedirectURI(client.RedirectURIs, p.RedirectURI) {
		return nil, &OAuthNoRedirectError{Code: oauthErrorInvalidRequest, Description: "redirect_uri is not registered for this client"}
	}
	if p.State != nil && len(*p.State) > maxStateLength {
		return nil, s.redirectError(p.RedirectURI, nil, &authorizeFailure{oauthErrorInvalidRequest, "state is too long"})
	}

	scope, resource, failure := s.validateAuthorizeParams(p)
	if failure != nil {
		return nil, s.redirectError(p.RedirectURI, p.State, failure)
	}

	id, err := utils.GenerateRandomID(authorizationIDRandomBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to generate authorization id: %w", err)
	}
	authorization := models.OAuthAuthorization{
		ID:            id,
		ClientID:      client.ID,
		RedirectURI:   p.RedirectURI,
		State:         p.State,
		Scope:         scope,
		Resource:      resource,
		CodeChallenge: p.CodeChallenge,
		Status:        types.OAuthAuthorizationPending,
		ExpiresAt:     time.Now().Add(pendingAuthorizationTTL),
	}
	if err := s.db.WithContext(ctx).Create(&authorization).Error; err != nil {
		return nil, fmt.Errorf("failed to store authorization request: %w", err)
	}
	consentQuery := url.Values{"id": {id}}
	return &OAuthAuthorizeResult{ConsentURL: s.frontendURL + consentPath + "?" + consentQuery.Encode()}, nil
}

// GetPending returns the user's pending authorization, binding it to the user on first view.
func (s *OAuthAuthorizationService) GetPending(ctx context.Context, id string, userID uint) (*models.OAuthAuthorization, error) {
	db := s.db.WithContext(ctx)
	if err := db.Model(&models.OAuthAuthorization{}).
		Where("id = ? AND user_id IS NULL AND status = ? AND expires_at > now()", id, types.OAuthAuthorizationPending).
		Update("user_id", userID).Error; err != nil {
		return nil, fmt.Errorf("failed to bind authorization: %w", err)
	}

	var authorization models.OAuthAuthorization
	err := db.Preload("Client").Scopes(pendingForUser(id, userID)).First(&authorization).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrOAuthAuthorizationNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load authorization: %w", err)
	}
	return &authorization, nil
}

// Approve issues a single-use authorization code for the user's pending authorization and returns the client redirect carrying it.
func (s *OAuthAuthorizationService) Approve(ctx context.Context, id string, userID uint) (string, error) {
	code, codeHash, err := utils.GenerateOpaqueToken(utils.AuthorizationCodePrefix)
	if err != nil {
		return "", fmt.Errorf("failed to generate authorization code: %w", err)
	}

	var authorization models.OAuthAuthorization
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Scopes(pendingForUser(id, userID)).First(&authorization).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrOAuthAuthorizationNotFound
			}
			return fmt.Errorf("failed to load authorization: %w", err)
		}
		grant, err := s.grantService.FindOrCreateOAuthGrant(tx, userID, authorization.ClientID, authorization.Scope, authorization.Resource)
		if err != nil {
			return err
		}
		return transitionPending(tx.Model(&models.OAuthAuthorization{}), id, userID, map[string]any{
			"status":          types.OAuthAuthorizationApproved,
			"code_hash":       codeHash,
			"code_expires_at": dbNowPlus(authorizationCodeTTL),
			"grant_id":        grant.ID,
		})
	})
	if err != nil {
		return "", err
	}
	return s.clientRedirect(authorization.RedirectURI, authorization.State, url.Values{"code": {code}})
}

// Deny closes the user's pending authorization and returns the client redirect carrying access_denied.
func (s *OAuthAuthorizationService) Deny(ctx context.Context, id string, userID uint) (string, error) {
	var authorization models.OAuthAuthorization
	err := transitionPending(
		s.db.WithContext(ctx).Model(&authorization).Clauses(clause.Returning{}),
		id, userID,
		map[string]any{"status": types.OAuthAuthorizationDenied},
	)
	if err != nil {
		return "", err
	}
	return s.clientRedirect(authorization.RedirectURI, authorization.State, url.Values{
		"error":             {oauthErrorAccessDenied},
		"error_description": {"the user denied the request"},
	})
}

// ConsumeCode redeems an authorization code exactly once inside the caller's token-issuing transaction.
// A replayed code returns its authorization with ErrOAuthCodeReplayed so the caller can revoke the issued tokens.
func (s *OAuthAuthorizationService) ConsumeCode(tx *gorm.DB, code string) (*models.OAuthAuthorization, error) {
	codeHash := utils.HashOpaqueToken(code)

	var authorization models.OAuthAuthorization
	result := tx.Model(&authorization).
		Clauses(clause.Returning{}).
		Where("code_hash = ? AND consumed_at IS NULL AND code_expires_at > now() AND status = ?", codeHash, types.OAuthAuthorizationApproved).
		Update("consumed_at", gorm.Expr("now()"))
	if result.Error != nil {
		return nil, fmt.Errorf("failed to redeem authorization code: %w", result.Error)
	}
	if result.RowsAffected == 1 {
		return &authorization, nil
	}
	return findConsumedAuthorization(tx, codeHash)
}

// SetIssuedFamily records the token family issued for a redeemed code, once, so a later replay can revoke it.
func (s *OAuthAuthorizationService) SetIssuedFamily(tx *gorm.DB, id, family string) error {
	result := tx.Model(&models.OAuthAuthorization{}).
		Where("id = ? AND consumed_at IS NOT NULL AND issued_family IS NULL", id).
		Update("issued_family", family)
	if result.Error != nil {
		return fmt.Errorf("failed to record issued token family: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("%w: no redeemed authorization without a token family", ErrOAuthAuthorizationNotFound)
	}
	return nil
}

// DeleteExpired removes authorizations whose pending lifetime ended more than a day ago.
func (s *OAuthAuthorizationService) DeleteExpired(ctx context.Context) (int64, error) {
	result := s.db.WithContext(ctx).
		Where("expires_at < ?", dbNowPlus(-expiredAuthorizationRetention)).
		Delete(&models.OAuthAuthorization{})
	if result.Error != nil {
		return 0, fmt.Errorf("failed to delete expired authorizations: %w", result.Error)
	}
	return result.RowsAffected, nil
}

func (s *OAuthAuthorizationService) resolveClient(ctx context.Context, clientID string) (*models.OAuthClient, error) {
	if clientID == "" {
		return nil, &OAuthNoRedirectError{Code: oauthErrorInvalidRequest, Description: "client_id is required"}
	}
	client, err := s.clientService.Resolve(ctx, clientID)
	if errors.Is(err, ErrOAuthInvalidClient) {
		return nil, &OAuthNoRedirectError{Code: oauthErrorInvalidClient, Description: "the client is unknown or could not be verified"}
	}
	if err != nil {
		return nil, err
	}
	return client, nil
}

func (s *OAuthAuthorizationService) validateAuthorizeParams(p requests.OAuthAuthorizeParams) (string, string, *authorizeFailure) {
	if p.RepeatedParameter != "" {
		return "", "", &authorizeFailure{oauthErrorInvalidRequest, p.RepeatedParameter + " must not be repeated"}
	}
	if failure := validateResponseType(p.ResponseType); failure != nil {
		return "", "", failure
	}
	if failure := validateCodeChallenge(p.CodeChallenge, p.CodeChallengeMethod); failure != nil {
		return "", "", failure
	}
	scope, failure := resolveRequestedScope(p.Scope)
	if failure != nil {
		return "", "", failure
	}
	resource, failure := s.resolveRequestedResource(p.Resource)
	if failure != nil {
		return "", "", failure
	}
	return scope, resource, nil
}

func (s *OAuthAuthorizationService) resolveRequestedResource(raw string) (string, *authorizeFailure) {
	if raw == "" {
		return s.resource, nil
	}
	normalized, err := utils.NormalizeResource(raw)
	if err != nil || normalized != s.resource {
		return "", &authorizeFailure{oauthErrorInvalidTarget, "the requested resource is not served by this authorization server"}
	}
	return normalized, nil
}

func (s *OAuthAuthorizationService) redirectError(redirectURI string, state *string, failure *authorizeFailure) error {
	redirectURL, err := s.clientRedirect(redirectURI, state, url.Values{
		"error":             {failure.code},
		"error_description": {failure.description},
	})
	if err != nil {
		return err
	}
	return &OAuthRedirectError{RedirectURL: redirectURL}
}

// clientRedirect merges the response parameters, state and issuer into the redirect URI's existing query.
func (s *OAuthAuthorizationService) clientRedirect(redirectURI string, state *string, params url.Values) (string, error) {
	target, err := url.Parse(redirectURI)
	if err != nil {
		return "", fmt.Errorf("failed to parse redirect URI: %w", err)
	}
	query := target.Query()
	for key, values := range params {
		query[key] = values
	}
	if state != nil {
		query.Set("state", *state)
	}
	query.Set("iss", s.issuer)
	target.RawQuery = query.Encode()
	return target.String(), nil
}

func validateResponseType(responseType string) *authorizeFailure {
	switch responseType {
	case responseTypeCode:
		return nil
	case "":
		return &authorizeFailure{oauthErrorInvalidRequest, "response_type is required"}
	default:
		return &authorizeFailure{oauthErrorUnsupportedResponseType, "only the code response type is supported"}
	}
}

func validateCodeChallenge(challenge, method string) *authorizeFailure {
	if challenge == "" {
		return &authorizeFailure{oauthErrorInvalidRequest, "code_challenge is required"}
	}
	if !utils.IsValidCodeChallenge(challenge) {
		return &authorizeFailure{oauthErrorInvalidRequest, "code_challenge is malformed"}
	}
	if method != codeChallengeMethodS256 {
		return &authorizeFailure{oauthErrorInvalidRequest, "code_challenge_method must be S256"}
	}
	return nil
}

func resolveRequestedScope(raw string) (string, *authorizeFailure) {
	scopes, err := utils.ParseScope(raw)
	if err != nil {
		return "", &authorizeFailure{oauthErrorInvalidScope, "the requested scope is not supported"}
	}
	if len(scopes) == 0 {
		scopes = defaultAuthorizationScopes
	}
	if !slices.Contains(scopes, types.ScopeRead) && !slices.Contains(scopes, types.ScopeWrite) {
		return "", &authorizeFailure{oauthErrorInvalidScope, "scope must include monexa.read or monexa.write"}
	}
	return utils.FormatScope(scopes), nil
}

func pendingForUser(id string, userID uint) func(*gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Where("id = ? AND user_id = ? AND status = ? AND expires_at > now()", id, userID, types.OAuthAuthorizationPending)
	}
}

// transitionPending applies changes only while the user's authorization is still pending and unexpired.
func transitionPending(query *gorm.DB, id string, userID uint, changes map[string]any) error {
	result := query.Scopes(pendingForUser(id, userID)).Updates(changes)
	if result.Error != nil {
		return fmt.Errorf("failed to update authorization: %w", result.Error)
	}
	if result.RowsAffected != 1 {
		return ErrOAuthAuthorizationNotFound
	}
	return nil
}

func findConsumedAuthorization(db *gorm.DB, codeHash string) (*models.OAuthAuthorization, error) {
	var authorization models.OAuthAuthorization
	err := db.Where("code_hash = ? AND consumed_at IS NOT NULL", codeHash).First(&authorization).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("%w: authorization code is invalid or expired", ErrOAuthInvalidGrant)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to look up authorization code: %w", err)
	}
	return &authorization, fmt.Errorf("%w: %w", ErrOAuthInvalidGrant, ErrOAuthCodeReplayed)
}

func dbNowPlus(offset time.Duration) clause.Expr {
	return gorm.Expr("now() + make_interval(secs => ?)", offset.Seconds())
}
