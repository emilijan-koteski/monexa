package services

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/responses"
	"github.com/emilijan-koteski/monexa/internal/token"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	refreshReuseGrace           = 60 * time.Second
	expiredTokenRetention       = 24 * time.Hour
	minDelegationLifetime       = time.Second
	bearerTokenType             = "Bearer"
	issuedAccessTokenType       = "urn:ietf:params:oauth:token-type:access_token"
	personalAccessTokenClientID = "pat"
)

type OAuthTokenService struct {
	db                   *gorm.DB
	grantService         *OAuthGrantService
	clientService        *OAuthClientService
	authorizationService *OAuthAuthorizationService
	legalDocumentService *LegalDocumentService
	tokenMaker           *token.JWTMaker
	resourceURL          string
	mcpClientID          string
	mcpClientSecret      string
	accessTokenTTL       time.Duration
	refreshTokenTTL      time.Duration
}

type delegationSubject struct {
	token *models.OAuthToken
	grant *models.OAuthGrant
	user  *models.User
}

func NewOAuthTokenService(db *gorm.DB, grantService *OAuthGrantService, clientService *OAuthClientService,
	authorizationService *OAuthAuthorizationService, legalDocumentService *LegalDocumentService,
	tokenMaker *token.JWTMaker, resourceURL, mcpClientID, mcpClientSecret string,
	accessTokenTTL, refreshTokenTTL time.Duration) *OAuthTokenService {
	return &OAuthTokenService{
		db:                   db,
		grantService:         grantService,
		clientService:        clientService,
		authorizationService: authorizationService,
		legalDocumentService: legalDocumentService,
		tokenMaker:           tokenMaker,
		resourceURL:          resourceURL,
		mcpClientID:          mcpClientID,
		mcpClientSecret:      mcpClientSecret,
		accessTokenTTL:       accessTokenTTL,
		refreshTokenTTL:      refreshTokenTTL,
	}
}

// ExchangeCode redeems an authorization code for a new token family in one transaction.
// A code stays burned when verification fails, and a replayed code revokes the family it issued.
func (s *OAuthTokenService) ExchangeCode(ctx context.Context, clientID, code, redirectURI, codeVerifier, resource string) (*responses.OAuthTokenResponse, error) {
	var issued *responses.OAuthTokenResponse
	var rejection error
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		authorization, err := s.authorizationService.ConsumeCode(tx, code)
		if errors.Is(err, ErrOAuthCodeReplayed) {
			rejection = err
			return revokeIssuedFamily(tx, authorization.IssuedFamily)
		}
		if err != nil {
			return err
		}

		grant, err := verifyCodeRedemption(tx, authorization, clientID, redirectURI, codeVerifier, resource)
		if errors.Is(err, ErrOAuthInvalidGrant) {
			rejection = err
			return nil
		}
		if err != nil {
			return err
		}

		family := uuid.NewString()
		if issued, err = s.issueTokenPair(tx, grant.ID, family, nil, authorization.Scope); err != nil {
			return err
		}
		return s.authorizationService.SetIssuedFamily(tx, authorization.ID, family)
	})
	if err != nil {
		return nil, err
	}
	if rejection != nil {
		return nil, rejection
	}
	return issued, nil
}

// Refresh rotates a refresh token within its family. Reusing a rotated token revokes the family, unless it is
// the immediate parent retried within refreshReuseGrace, which replaces its unused child instead.
func (s *OAuthTokenService) Refresh(ctx context.Context, clientID, refreshToken, scope, resource string) (*responses.OAuthTokenResponse, error) {
	if _, err := s.clientService.GetStoredClient(ctx, clientID); err != nil {
		if errors.Is(err, ErrOAuthInvalidClient) {
			return nil, invalidGrant("the client is not registered")
		}
		return nil, err
	}

	var issued *responses.OAuthTokenResponse
	var rejection error
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		presented, err := findToken(tx.Clauses(clause.Locking{Strength: "UPDATE"}), refreshToken)
		if err != nil {
			return err
		}
		now := time.Now()
		grant, err := verifyRefreshToken(tx, presented, clientID, now)
		if err != nil {
			return err
		}
		if resource != "" && !resourceMatches(resource, grant.Resource) {
			return fmt.Errorf("%w: resource does not match the grant", ErrOAuthInvalidTarget)
		}
		rotatedScope, err := narrowScope(presented.Scope, scope)
		if err != nil {
			return err
		}

		reused, err := rotateRefreshToken(tx, presented, now)
		if err != nil {
			return err
		}
		if reused {
			rejection = invalidGrant("refresh token was reused")
			return revokeFamily(tx, presented.Family, now)
		}
		issued, err = s.issueTokenPair(tx, grant.ID, presented.Family, &presented.ID, rotatedScope)
		return err
	})
	if err != nil {
		return nil, err
	}
	if rejection != nil {
		return nil, rejection
	}
	return issued, nil
}

// ExchangeForDelegatedToken trades an OAuth access token or PAT for a short-lived delegated API JWT (RFC 8693).
// Every rejection is ErrOAuthInvalidGrant so the caller learns nothing about why a subject token is unusable.
func (s *OAuthTokenService) ExchangeForDelegatedToken(ctx context.Context, subjectToken, resource string) (*responses.OAuthTokenResponse, error) {
	subject, err := s.loadDelegationSubject(s.db.WithContext(ctx), subjectToken, resource, time.Now())
	if err != nil {
		return nil, err
	}

	legalAcceptedAt := s.legalDocumentService.GetLegalAcceptedAt(ctx, subject.user.ID)
	delegated, claims, err := s.tokenMaker.CreateDelegatedAccessToken(
		subject.user.ID, subject.user.PPID, legalAcceptedAt, subject.token.Scope,
		delegatedClientID(subject.grant), strconv.FormatUint(uint64(subject.grant.ID), 10), subject.token.ExpiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to mint delegated token: %w", err)
	}
	if err := s.grantService.TouchLastUsed(ctx, subject.grant.ID); err != nil {
		log.Printf("oauth: %v", err)
	}
	return &responses.OAuthTokenResponse{
		AccessToken:     delegated,
		TokenType:       bearerTokenType,
		ExpiresIn:       wholeSeconds(time.Until(claims.ExpiresAt.Time)),
		Scope:           subject.token.Scope,
		IssuedTokenType: issuedAccessTokenType,
	}, nil
}

// AuthenticateMCPClient checks the MCP server's client credentials in constant time; unset credentials never match.
func (s *OAuthTokenService) AuthenticateMCPClient(clientID, clientSecret string) bool {
	if s.mcpClientID == "" || s.mcpClientSecret == "" {
		return false
	}
	return digestsMatch(clientID, s.mcpClientID)&digestsMatch(clientSecret, s.mcpClientSecret) == 1
}

// RevokeToken revokes a client's own token (RFC 7009): a refresh token takes its family with it, an access token only itself.
// Unknown tokens, other clients' tokens and PATs are ignored so the endpoint reveals nothing.
func (s *OAuthTokenService) RevokeToken(ctx context.Context, clientID, presentedToken string) error {
	db := s.db.WithContext(ctx)
	revoked, err := findToken(db.Preload("Grant"), presentedToken)
	if errors.Is(err, ErrOAuthInvalidGrant) {
		return nil
	}
	if err != nil {
		return err
	}
	if revoked.Grant == nil || revoked.Grant.ClientID == nil || *revoked.Grant.ClientID != clientID {
		return nil
	}

	now := time.Now()
	switch revoked.Type {
	case types.OAuthRefreshToken:
		return revokeFamily(db, revoked.Family, now)
	case types.OAuthAccessToken:
		return revokeTokens(db.Where("id = ?", revoked.ID), now)
	default:
		return nil
	}
}

// DeleteExpired removes tokens that expired, or whose grant was revoked, more than expiredTokenRetention ago.
func (s *OAuthTokenService) DeleteExpired(ctx context.Context) (int64, error) {
	cutoff := dbNowPlus(-expiredTokenRetention)
	longRevokedGrants := s.db.Model(&models.OAuthGrant{}).Select("id").Where("revoked_at < ?", cutoff)
	result := s.db.WithContext(ctx).
		Where("expires_at < ? OR grant_id IN (?)", cutoff, longRevokedGrants).
		Delete(&models.OAuthToken{})
	if result.Error != nil {
		return 0, fmt.Errorf("failed to delete expired tokens: %w", result.Error)
	}
	return result.RowsAffected, nil
}

// issueTokenPair stores a new access and refresh token for the grant's family and returns their plaintexts.
func (s *OAuthTokenService) issueTokenPair(tx *gorm.DB, grantID uint, family string, parentID *uint, scope string) (*responses.OAuthTokenResponse, error) {
	accessToken, accessHash, err := utils.GenerateOpaqueToken(utils.AccessTokenPrefix)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}
	refreshToken, refreshHash, err := utils.GenerateOpaqueToken(utils.RefreshTokenPrefix)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	now := time.Now()
	rows := []models.OAuthToken{
		{
			GrantID:     grantID,
			Type:        types.OAuthAccessToken,
			TokenHash:   accessHash,
			TokenPrefix: utils.TokenDisplayPrefix(accessToken),
			Family:      family,
			Scope:       scope,
			ExpiresAt:   now.Add(s.accessTokenTTL),
		},
		{
			GrantID:     grantID,
			Type:        types.OAuthRefreshToken,
			TokenHash:   refreshHash,
			TokenPrefix: utils.TokenDisplayPrefix(refreshToken),
			Family:      family,
			ParentID:    parentID,
			Scope:       scope,
			ExpiresAt:   now.Add(s.refreshTokenTTL),
		},
	}
	if err := tx.Create(&rows).Error; err != nil {
		return nil, fmt.Errorf("failed to store tokens: %w", err)
	}
	return &responses.OAuthTokenResponse{
		AccessToken:  accessToken,
		TokenType:    bearerTokenType,
		ExpiresIn:    wholeSeconds(s.accessTokenTTL),
		RefreshToken: refreshToken,
		Scope:        scope,
	}, nil
}

func (s *OAuthTokenService) loadDelegationSubject(db *gorm.DB, subjectToken, resource string, now time.Time) (*delegationSubject, error) {
	expectedType, ok := delegableTokenType(subjectToken)
	if !ok {
		return nil, invalidGrant("subject token is not an access token")
	}
	subject, err := findToken(db, subjectToken)
	if err != nil {
		return nil, err
	}
	switch {
	case subject.Type != expectedType:
		return nil, invalidGrant("subject token type does not match its prefix")
	case subject.RevokedAt != nil:
		return nil, invalidGrant("subject token is revoked")
	case !subject.ExpiresAt.After(now.Add(minDelegationLifetime)):
		return nil, invalidGrant("subject token is expired")
	}

	grant, user, err := loadLiveGrant(db, subject.GrantID, now)
	if err != nil {
		return nil, err
	}
	if grant.Resource != s.resourceURL || !resourceMatches(resource, grant.Resource) {
		return nil, invalidGrant("resource does not match the grant")
	}
	return &delegationSubject{token: subject, grant: grant, user: user}, nil
}

func verifyCodeRedemption(tx *gorm.DB, authorization *models.OAuthAuthorization, clientID, redirectURI, codeVerifier, resource string) (*models.OAuthGrant, error) {
	switch {
	case authorization.ClientID != clientID:
		return nil, invalidGrant("client_id does not match the authorization")
	case authorization.RedirectURI != redirectURI:
		return nil, invalidGrant("redirect_uri does not match the authorization")
	case !utils.VerifyPKCES256(codeVerifier, authorization.CodeChallenge):
		return nil, invalidGrant("code_verifier does not match the code challenge")
	case resource != "" && !resourceMatches(resource, authorization.Resource):
		return nil, invalidGrant("resource does not match the authorization")
	case authorization.GrantID == nil:
		return nil, invalidGrant("authorization has no grant")
	}
	grant, _, err := loadLiveGrant(tx, *authorization.GrantID, time.Now())
	return grant, err
}

func verifyRefreshToken(tx *gorm.DB, presented *models.OAuthToken, clientID string, now time.Time) (*models.OAuthGrant, error) {
	switch {
	case presented.Type != types.OAuthRefreshToken:
		return nil, invalidGrant("token is not a refresh token")
	case presented.RevokedAt != nil:
		return nil, invalidGrant("refresh token is revoked")
	case !presented.ExpiresAt.After(now):
		return nil, invalidGrant("refresh token is expired")
	}
	grant, _, err := loadLiveGrant(tx, presented.GrantID, now)
	if err != nil {
		return nil, err
	}
	if grant.ClientID == nil || *grant.ClientID != clientID {
		return nil, invalidGrant("refresh token was issued to another client")
	}
	return grant, nil
}

// rotateRefreshToken marks an unused token used. For a used token it reports reuse unless the token is the immediate
// parent retried within refreshReuseGrace, in which case its unused child is revoked so a replacement can be issued.
func rotateRefreshToken(tx *gorm.DB, presented *models.OAuthToken, now time.Time) (bool, error) {
	if presented.UsedAt == nil {
		if err := tx.Model(presented).Update("used_at", now).Error; err != nil {
			return false, fmt.Errorf("failed to mark refresh token used: %w", err)
		}
		return false, nil
	}
	if now.Sub(*presented.UsedAt) > refreshReuseGrace {
		return true, nil
	}
	result := tx.Model(&models.OAuthToken{}).
		Where("parent_id = ? AND type = ? AND used_at IS NULL AND revoked_at IS NULL", presented.ID, types.OAuthRefreshToken).
		Update("revoked_at", now)
	if result.Error != nil {
		return false, fmt.Errorf("failed to revoke the unused child token: %w", result.Error)
	}
	return result.RowsAffected == 0, nil
}

// narrowScope returns the scope for rotated tokens: the current scope, or a requested subset of it.
func narrowScope(current, requested string) (string, error) {
	scopes, err := utils.ParseScope(requested)
	if err != nil {
		return "", fmt.Errorf("%w: the requested scope is not supported", ErrOAuthInvalidScope)
	}
	if len(scopes) == 0 {
		return current, nil
	}
	for _, scope := range scopes {
		if !utils.HasScope(current, scope) {
			return "", fmt.Errorf("%w: the requested scope exceeds the granted scope", ErrOAuthInvalidScope)
		}
	}
	return utils.FormatScope(scopes), nil
}

// loadLiveGrant returns a grant that is neither revoked nor expired, together with its user while the account is not deleted.
func loadLiveGrant(db *gorm.DB, grantID uint, now time.Time) (*models.OAuthGrant, *models.User, error) {
	var grant models.OAuthGrant
	err := db.Where("id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)", grantID, now).Take(&grant).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, invalidGrant("grant is revoked or expired")
	}
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load grant: %w", err)
	}

	var user models.User
	err = db.Select("id", "ppid").Where("id = ?", grant.UserID).Take(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, invalidGrant("user no longer exists")
	}
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load user: %w", err)
	}
	return &grant, &user, nil
}

func findToken(db *gorm.DB, plaintext string) (*models.OAuthToken, error) {
	var row models.OAuthToken
	err := db.Where("token_hash = ?", utils.HashOpaqueToken(plaintext)).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, invalidGrant("unknown token")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load token: %w", err)
	}
	return &row, nil
}

func revokeIssuedFamily(tx *gorm.DB, family *string) error {
	if family == nil {
		return nil
	}
	return revokeFamily(tx, *family, time.Now())
}

func revokeFamily(db *gorm.DB, family string, now time.Time) error {
	return revokeTokens(db.Where("family = ?", family), now)
}

func revokeTokens(query *gorm.DB, now time.Time) error {
	if err := query.Model(&models.OAuthToken{}).Where("revoked_at IS NULL").Update("revoked_at", now).Error; err != nil {
		return fmt.Errorf("failed to revoke tokens: %w", err)
	}
	return nil
}

func delegableTokenType(plaintext string) (types.OAuthTokenType, bool) {
	switch {
	case strings.HasPrefix(plaintext, utils.AccessTokenPrefix):
		return types.OAuthAccessToken, true
	case strings.HasPrefix(plaintext, utils.PersonalAccessTokenPrefix):
		return types.OAuthPersonalAccessToken, true
	default:
		return "", false
	}
}

func delegatedClientID(grant *models.OAuthGrant) string {
	if grant.ClientID == nil {
		return personalAccessTokenClientID
	}
	return *grant.ClientID
}

func resourceMatches(raw, expected string) bool {
	normalized, err := utils.NormalizeResource(raw)
	return err == nil && normalized == expected
}

// digestsMatch compares sha256 digests in constant time so neither the value nor its length leaks; it returns 1 on a match.
func digestsMatch(given, expected string) int {
	givenDigest := sha256.Sum256([]byte(given))
	expectedDigest := sha256.Sum256([]byte(expected))
	return subtle.ConstantTimeCompare(givenDigest[:], expectedDigest[:])
}

// wholeSeconds turns a lifetime into a token response's expires_in, rounded down and at least one second.
func wholeSeconds(lifetime time.Duration) int64 {
	return max(int64(lifetime/time.Second), 1)
}

func invalidGrant(reason string) error {
	return fmt.Errorf("%w: %s", ErrOAuthInvalidGrant, reason)
}
