package services

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/responses"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	accessTokenPermissionRead      = "read"
	accessTokenPermissionReadWrite = "read_write"
	accessTokenNameMaxRunes        = 50
	accessTokenDefaultExpiryDays   = 90
	maxActiveAccessTokens          = 10
)

var accessTokenAllowedExpiryDays = map[int]bool{30: true, 90: true, 365: true}

type AccessTokenService struct {
	db           *gorm.DB
	grantService *OAuthGrantService
	resourceURL  string
}

type accessTokenRow struct {
	ID          uint
	Name        *string
	Scope       string
	TokenPrefix string
	CreatedAt   time.Time
	LastUsedAt  *time.Time
	ExpiresAt   time.Time
}

func NewAccessTokenService(db *gorm.DB, grantService *OAuthGrantService, resourceURL string) *AccessTokenService {
	return &AccessTokenService{db: db, grantService: grantService, resourceURL: resourceURL}
}

// Create issues a personal access token whose plaintext is returned once, enforcing the per-user cap under a user row lock.
func (s *AccessTokenService) Create(ctx context.Context, userID uint, req requests.AccessTokenRequest) (*responses.CreatedAccessTokenResponse, error) {
	name, scope, expiryDays, err := validateAccessTokenRequest(req)
	if err != nil {
		return nil, err
	}
	plaintext, hash, err := utils.GenerateOpaqueToken(utils.PersonalAccessTokenPrefix)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	now := time.Now().Truncate(time.Microsecond)
	expiresAt := now.Add(time.Duration(expiryDays) * 24 * time.Hour)
	grant := models.OAuthGrant{
		UserID:    userID,
		CreatedAt: now,
		Kind:      types.OAuthGrantKindPAT,
		Name:      &name,
		Scope:     scope,
		Resource:  s.resourceURL,
		ExpiresAt: &expiresAt,
	}
	tokenRow := models.OAuthToken{
		Type:        types.OAuthPersonalAccessToken,
		TokenHash:   hash,
		TokenPrefix: utils.TokenDisplayPrefix(plaintext),
		Family:      uuid.NewString(),
		Scope:       scope,
		ExpiresAt:   expiresAt,
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockUserRow(tx, userID); err != nil {
			return err
		}
		var active int64
		if err := tx.Model(&models.OAuthGrant{}).
			Where("user_id = ? AND kind = ? AND revoked_at IS NULL AND expires_at > ?", userID, types.OAuthGrantKindPAT, now).
			Count(&active).Error; err != nil {
			return fmt.Errorf("failed to count access tokens: %w", err)
		}
		if active >= maxActiveAccessTokens {
			return fmt.Errorf("%w (%d)", ErrAccessTokenLimitReached, maxActiveAccessTokens)
		}
		if err := tx.Create(&grant).Error; err != nil {
			return fmt.Errorf("failed to create access token grant: %w", err)
		}
		tokenRow.GrantID = grant.ID
		if err := tx.Create(&tokenRow).Error; err != nil {
			return fmt.Errorf("failed to create access token: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &responses.CreatedAccessTokenResponse{
		AccessTokenResponse: responses.AccessTokenResponse{
			ID:          grant.ID,
			Name:        name,
			TokenPrefix: tokenRow.TokenPrefix,
			Scopes:      strings.Fields(scope),
			CreatedAt:   grant.CreatedAt,
			ExpiresAt:   expiresAt,
		},
		Token: plaintext,
	}, nil
}

// List returns the user's active personal access tokens, newest first.
func (s *AccessTokenService) List(ctx context.Context, userID uint) ([]responses.AccessTokenResponse, error) {
	rows := []accessTokenRow{}
	if err := s.db.WithContext(ctx).
		Table("oauth_grants").
		Select("oauth_grants.id, oauth_grants.name, oauth_grants.scope, oauth_tokens.token_prefix, oauth_grants.created_at, oauth_grants.last_used_at, oauth_grants.expires_at").
		Joins("JOIN oauth_tokens ON oauth_tokens.grant_id = oauth_grants.id AND oauth_tokens.type = ? AND oauth_tokens.revoked_at IS NULL", types.OAuthPersonalAccessToken).
		Where("oauth_grants.user_id = ? AND oauth_grants.kind = ? AND oauth_grants.revoked_at IS NULL AND oauth_grants.expires_at > ?", userID, types.OAuthGrantKindPAT, time.Now()).
		Order("oauth_grants.created_at DESC, oauth_grants.id DESC").
		Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("failed to list access tokens: %w", err)
	}

	result := make([]responses.AccessTokenResponse, 0, len(rows))
	for _, row := range rows {
		result = append(result, row.response())
	}
	return result, nil
}

// Revoke revokes one of the user's personal access tokens, returning gorm.ErrRecordNotFound for anything else.
func (s *AccessTokenService) Revoke(ctx context.Context, userID, grantID uint) error {
	return s.grantService.RevokePersonalAccessTokenGrant(ctx, userID, grantID)
}

func (r accessTokenRow) response() responses.AccessTokenResponse {
	name := ""
	if r.Name != nil {
		name = *r.Name
	}
	return responses.AccessTokenResponse{
		ID:          r.ID,
		Name:        name,
		TokenPrefix: r.TokenPrefix,
		Scopes:      strings.Fields(r.Scope),
		CreatedAt:   r.CreatedAt,
		LastUsedAt:  r.LastUsedAt,
		ExpiresAt:   r.ExpiresAt,
	}
}

func validateAccessTokenRequest(req requests.AccessTokenRequest) (name, scope string, expiryDays int, err error) {
	name = sanitizeClientName(req.Name)
	if name == "" || utf8.RuneCountInString(name) > accessTokenNameMaxRunes {
		return "", "", 0, fmt.Errorf("%w: name must be 1 to %d characters", ErrAccessTokenInvalid, accessTokenNameMaxRunes)
	}

	switch req.Permission {
	case accessTokenPermissionRead:
		scope = utils.FormatScope([]types.OAuthScope{types.ScopeRead})
	case accessTokenPermissionReadWrite:
		scope = utils.FormatScope([]types.OAuthScope{types.ScopeRead, types.ScopeWrite})
	default:
		return "", "", 0, fmt.Errorf("%w: permission must be %q or %q", ErrAccessTokenInvalid, accessTokenPermissionRead, accessTokenPermissionReadWrite)
	}

	expiryDays = req.ExpiresInDays
	if expiryDays == 0 {
		expiryDays = accessTokenDefaultExpiryDays
	}
	if !accessTokenAllowedExpiryDays[expiryDays] {
		return "", "", 0, fmt.Errorf("%w: expiresInDays must be 30, 90 or 365", ErrAccessTokenInvalid)
	}
	return name, scope, expiryDays, nil
}
