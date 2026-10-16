package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/emilijan-koteski/monexa/internal/clients"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	dcrClientIDPrefix      = "mnx_client_"
	dcrClientIDRandomBytes = 16
	dcrAuthMethodNone      = "none"
	maxRegisteredRedirects = 5
	clientNameMaxRunes     = 100
	storedURIMaxLength     = 2048

	cimdClientIDPrefix          = "https://"
	cimdClientIDMaxLength       = 2048
	cimdCacheTTL                = 24 * time.Hour
	cimdNegativeCacheTTL        = 5 * time.Minute
	cimdNegativeCacheMaxEntries = 1000
	cimdMaxConcurrentFetches    = 4
)

var (
	dcrDefaultGrantTypes    = []string{"authorization_code", "refresh_token"}
	dcrAllowedGrantTypes    = map[string]bool{"authorization_code": true, "refresh_token": true}
	dcrAllowedResponseTypes = map[string]bool{"code": true}
	cimdUpsertColumns       = []string{"kind", "name", "redirect_uris", "client_uri", "logo_uri", "expires_at", "updated_at"}
)

type cimdFetcher interface {
	Fetch(ctx context.Context, clientIDURL string) (*clients.CIMDDocument, error)
}

type cimdNegativeCache struct {
	mu      sync.Mutex
	entries map[string]time.Time
}

type OAuthClientService struct {
	db         *gorm.DB
	cimd       cimdFetcher
	negative   cimdNegativeCache
	flights    clientFlightGroup
	fetchSlots chan struct{}
	now        func() time.Time
}

func NewOAuthClientService(db *gorm.DB, cimdClient cimdFetcher) *OAuthClientService {
	return &OAuthClientService{
		db:         db,
		cimd:       cimdClient,
		fetchSlots: make(chan struct{}, cimdMaxConcurrentFetches),
		now:        time.Now,
	}
}

func (s *OAuthClientService) Register(ctx context.Context, req requests.OAuthClientRegistrationRequest) (*models.OAuthClient, error) {
	if err := validateRedirectURIs(req.RedirectURIs); err != nil {
		return nil, fmt.Errorf("%w: %w: %v", ErrOAuthInvalidRequest, ErrOAuthInvalidRedirectURI, err)
	}
	if err := validateRegistrationMetadata(req); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrOAuthInvalidRequest, err)
	}
	name := sanitizeClientName(req.ClientName)
	if name == "" {
		return nil, fmt.Errorf("%w: client_name is required", ErrOAuthInvalidRequest)
	}
	id, err := newDCRClientID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate client id: %w", err)
	}

	client := models.OAuthClient{
		ID:           id,
		Kind:         types.OAuthClientKindDCR,
		Name:         name,
		RedirectURIs: append([]string(nil), req.RedirectURIs...),
		ClientURI:    safeHTTPSURL(req.ClientURI),
	}
	if err := s.db.WithContext(ctx).Create(&client).Error; err != nil {
		return nil, fmt.Errorf("failed to register client: %w", err)
	}
	return &client, nil
}

// Resolve loads the client for /authorize, fetching and caching its metadata document when the client_id is an https URL.
func (s *OAuthClientService) Resolve(ctx context.Context, clientID string) (*models.OAuthClient, error) {
	if strings.HasPrefix(clientID, cimdClientIDPrefix) {
		return s.resolveCIMD(ctx, clientID)
	}
	return s.GetStoredClient(ctx, clientID)
}

// GetStoredClient reads a client from the database only and never fetches metadata documents.
func (s *OAuthClientService) GetStoredClient(ctx context.Context, clientID string) (*models.OAuthClient, error) {
	if clientID == "" {
		return nil, fmt.Errorf("%w: client_id is required", ErrOAuthInvalidClient)
	}
	var client models.OAuthClient
	err := s.db.WithContext(ctx).Where("id = ?", clientID).First(&client).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("%w: unknown client", ErrOAuthInvalidClient)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load client: %w", err)
	}
	return &client, nil
}

// DeleteStaleClients removes clients older than the given age that have no grants and no live pending authorizations.
func (s *OAuthClientService) DeleteStaleClients(ctx context.Context, olderThan time.Duration) (int64, error) {
	now := s.now()
	result := s.db.WithContext(ctx).
		Where("created_at < ?", now.Add(-olderThan)).
		Where("NOT EXISTS (SELECT 1 FROM oauth_grants WHERE oauth_grants.client_id = oauth_clients.id)").
		Where(
			"NOT EXISTS (SELECT 1 FROM oauth_authorizations WHERE oauth_authorizations.client_id = oauth_clients.id AND oauth_authorizations.status = ? AND oauth_authorizations.expires_at > ?)",
			types.OAuthAuthorizationPending, now,
		).
		Delete(&models.OAuthClient{})
	if result.Error != nil {
		return 0, fmt.Errorf("failed to delete stale clients: %w", result.Error)
	}
	return result.RowsAffected, nil
}

func (s *OAuthClientService) resolveCIMD(ctx context.Context, clientID string) (*models.OAuthClient, error) {
	if !isWellFormedCIMDClientID(clientID) {
		return nil, fmt.Errorf("%w: malformed client_id URL", ErrOAuthInvalidClient)
	}
	client, err := s.cachedCIMDClient(ctx, clientID)
	if client != nil || err != nil {
		return client, err
	}
	client, err = s.flights.do(ctx, clientID, func(loadCtx context.Context) (*models.OAuthClient, error) {
		return s.loadCIMDClient(loadCtx, clientID)
	})
	if ctxErr := ctx.Err(); ctxErr != nil && errors.Is(err, ctxErr) {
		return nil, fmt.Errorf("%w: %w", ErrOAuthInvalidClient, ctxErr)
	}
	return client, err
}

func (s *OAuthClientService) cachedCIMDClient(ctx context.Context, clientID string) (*models.OAuthClient, error) {
	now := s.now()
	var client models.OAuthClient
	err := s.db.WithContext(ctx).
		Where("id = ? AND kind = ? AND expires_at > ?", clientID, types.OAuthClientKindCIMD, now).
		First(&client).Error
	if err == nil {
		return &client, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to load client: %w", err)
	}
	if s.negative.isBlocked(clientID, now) {
		return nil, fmt.Errorf("%w: client metadata document was recently unavailable", ErrOAuthInvalidClient)
	}
	return nil, nil
}

func (s *OAuthClientService) loadCIMDClient(ctx context.Context, clientID string) (*models.OAuthClient, error) {
	client, err := s.cachedCIMDClient(ctx, clientID)
	if client != nil || err != nil {
		return client, err
	}
	doc, err := s.fetchCIMDDocument(ctx, clientID)
	if err != nil {
		return nil, err
	}
	client, err = cimdClientFromDocument(clientID, doc, s.now().Add(cimdCacheTTL))
	if err != nil {
		s.negative.block(clientID, s.now())
		log.Printf("oauth: rejected client metadata document for %q: %v", clientID, err)
		return nil, fmt.Errorf("%w: client metadata document is not acceptable", ErrOAuthInvalidClient)
	}
	if err := s.upsertCIMDClient(ctx, client); err != nil {
		return nil, err
	}
	return client, nil
}

func (s *OAuthClientService) fetchCIMDDocument(ctx context.Context, clientID string) (*clients.CIMDDocument, error) {
	if err := s.acquireFetchSlot(ctx); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrOAuthInvalidClient, err)
	}
	defer s.releaseFetchSlot()

	doc, err := s.cimd.Fetch(ctx, clientID)
	if err != nil {
		if ctx.Err() == nil {
			s.negative.block(clientID, s.now())
		}
		log.Printf("oauth: failed to fetch client metadata document for %q: %v", clientID, err)
		return nil, fmt.Errorf("%w: client metadata document could not be fetched", ErrOAuthInvalidClient)
	}
	return doc, nil
}

func (s *OAuthClientService) acquireFetchSlot(ctx context.Context) error {
	select {
	case s.fetchSlots <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (s *OAuthClientService) releaseFetchSlot() {
	<-s.fetchSlots
}

func (s *OAuthClientService) upsertCIMDClient(ctx context.Context, client *models.OAuthClient) error {
	err := s.db.WithContext(ctx).
		Clauses(
			clause.OnConflict{
				Columns:   []clause.Column{{Name: "id"}},
				DoUpdates: clause.AssignmentColumns(cimdUpsertColumns),
			},
			clause.Returning{},
		).
		Create(client).Error
	if err != nil {
		return fmt.Errorf("failed to store client: %w", err)
	}
	return nil
}

func (c *cimdNegativeCache) isBlocked(clientID string, now time.Time) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	expiresAt, found := c.entries[clientID]
	if !found {
		return false
	}
	if !now.Before(expiresAt) {
		delete(c.entries, clientID)
		return false
	}
	return true
}

func (c *cimdNegativeCache) block(clientID string, now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.entries == nil {
		c.entries = map[string]time.Time{}
	}
	if _, present := c.entries[clientID]; !present && len(c.entries) >= cimdNegativeCacheMaxEntries {
		c.dropExpired(now)
	}
	if _, present := c.entries[clientID]; !present && len(c.entries) >= cimdNegativeCacheMaxEntries {
		c.dropOldest()
	}
	c.entries[clientID] = now.Add(cimdNegativeCacheTTL)
}

func (c *cimdNegativeCache) dropExpired(now time.Time) {
	for clientID, expiresAt := range c.entries {
		if !now.Before(expiresAt) {
			delete(c.entries, clientID)
		}
	}
}

func (c *cimdNegativeCache) dropOldest() {
	var oldestID string
	var oldestExpiry time.Time
	for clientID, expiresAt := range c.entries {
		if oldestID == "" || expiresAt.Before(oldestExpiry) {
			oldestID, oldestExpiry = clientID, expiresAt
		}
	}
	delete(c.entries, oldestID)
}

func cimdClientFromDocument(clientID string, doc *clients.CIMDDocument, expiresAt time.Time) (*models.OAuthClient, error) {
	name := sanitizeClientName(doc.ClientName)
	if name == "" {
		return nil, errors.New("client_name is empty after sanitizing")
	}
	if err := validateRedirectURIs(doc.RedirectURIs); err != nil {
		return nil, err
	}
	return &models.OAuthClient{
		ID:           clientID,
		Kind:         types.OAuthClientKindCIMD,
		Name:         name,
		RedirectURIs: append([]string(nil), doc.RedirectURIs...),
		ClientURI:    safeHTTPSURL(doc.ClientURI),
		LogoURI:      safeHTTPSURL(doc.LogoURI),
		ExpiresAt:    &expiresAt,
	}, nil
}

func validateRedirectURIs(uris []string) error {
	if len(uris) == 0 {
		return errors.New("redirect_uris must contain at least one URI")
	}
	if len(uris) > maxRegisteredRedirects {
		return fmt.Errorf("redirect_uris must contain at most %d URIs", maxRegisteredRedirects)
	}
	for _, uri := range uris {
		if err := utils.ValidateRegisteredRedirectURI(uri); err != nil {
			return fmt.Errorf("invalid redirect URI %q: %w", uri, err)
		}
	}
	return nil
}

func validateRegistrationMetadata(req requests.OAuthClientRegistrationRequest) error {
	if req.TokenEndpointAuthMethod != "" && req.TokenEndpointAuthMethod != dcrAuthMethodNone {
		return fmt.Errorf("token_endpoint_auth_method %q is not supported", req.TokenEndpointAuthMethod)
	}
	for _, grantType := range req.GrantTypes {
		if !dcrAllowedGrantTypes[grantType] {
			return fmt.Errorf("grant_type %q is not supported", grantType)
		}
	}
	for _, responseType := range req.ResponseTypes {
		if !dcrAllowedResponseTypes[responseType] {
			return fmt.Errorf("response_type %q is not supported", responseType)
		}
	}
	return nil
}

func newDCRClientID() (string, error) {
	random := make([]byte, dcrClientIDRandomBytes)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	return dcrClientIDPrefix + hex.EncodeToString(random), nil
}

func isWellFormedCIMDClientID(raw string) bool {
	if len(raw) > cimdClientIDMaxLength || strings.Contains(raw, "#") {
		return false
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil {
		return false
	}
	return parsed.Path != "" && parsed.Path != "/"
}

func sanitizeClientName(raw string) string {
	stripped := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || isBidiControl(r) {
			return -1
		}
		return r
	}, raw)
	name := strings.TrimSpace(stripped)
	if utf8.RuneCountInString(name) > clientNameMaxRunes {
		name = string([]rune(name)[:clientNameMaxRunes])
	}
	return strings.TrimSpace(name)
}

func isBidiControl(r rune) bool {
	return r >= 0x202A && r <= 0x202E ||
		r >= 0x2066 && r <= 0x2069 ||
		r == 0x200E || r == 0x200F || r == 0x061C
}

func safeHTTPSURL(raw *string) *string {
	if raw == nil {
		return nil
	}
	value := strings.TrimSpace(*raw)
	if value == "" || len(value) > storedURIMaxLength || strings.ContainsFunc(value, unicode.IsSpace) {
		return nil
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil {
		return nil
	}
	return &value
}
