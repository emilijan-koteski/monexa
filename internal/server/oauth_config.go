package server

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilijan-koteski/monexa/internal/utils"
)

const (
	envOAuthIssuerURL       = "OAUTH_ISSUER_URL"
	envMCPResourceURL       = "MCP_RESOURCE_URL"
	envMCPClientID          = "MCP_CLIENT_ID"
	envMCPClientSecret      = "MCP_CLIENT_SECRET"
	envOAuthAccessTokenTTL  = "OAUTH_ACCESS_TOKEN_TTL"
	envOAuthRefreshTokenTTL = "OAUTH_REFRESH_TOKEN_TTL"

	minMCPClientSecretLength    = 32
	defaultOAuthAccessTokenTTL  = time.Hour
	defaultOAuthRefreshTokenTTL = 2160 * time.Hour
)

var oauthRequiredEnv = []string{
	envOAuthIssuerURL,
	envMCPResourceURL,
	envMCPClientID,
	envMCPClientSecret,
}

type OAuthConfig struct {
	IssuerURL       string
	ResourceURL     string
	MCPClientID     string
	MCPClientSecret string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

// LoadOAuthConfig reads the OAuth authorization server settings from the environment.
// It returns (nil, nil) when none of the required variables are set, and an error when they are only partly set or malformed.
func LoadOAuthConfig() (*OAuthConfig, error) {
	missing := missingEnv(oauthRequiredEnv...)
	if len(missing) == len(oauthRequiredEnv) {
		return nil, nil
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("incomplete OAuth configuration, missing: %s", strings.Join(missing, ", "))
	}

	issuer, err := validateOAuthIssuer(os.Getenv(envOAuthIssuerURL))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", envOAuthIssuerURL, err)
	}
	resource, err := validateMCPResource(os.Getenv(envMCPResourceURL))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", envMCPResourceURL, err)
	}
	secret := os.Getenv(envMCPClientSecret)
	if utf8.RuneCountInString(secret) < minMCPClientSecretLength {
		return nil, fmt.Errorf("%s must be at least %d characters", envMCPClientSecret, minMCPClientSecretLength)
	}
	accessTTL, err := durationFromEnv(envOAuthAccessTokenTTL, defaultOAuthAccessTokenTTL)
	if err != nil {
		return nil, err
	}
	refreshTTL, err := durationFromEnv(envOAuthRefreshTokenTTL, defaultOAuthRefreshTokenTTL)
	if err != nil {
		return nil, err
	}

	return &OAuthConfig{
		IssuerURL:       issuer,
		ResourceURL:     resource,
		MCPClientID:     os.Getenv(envMCPClientID),
		MCPClientSecret: secret,
		AccessTokenTTL:  accessTTL,
		RefreshTokenTTL: refreshTTL,
	}, nil
}

func validateOAuthIssuer(raw string) (string, error) {
	if strings.ContainsAny(raw, "?#") {
		return "", errors.New("must not contain a query or fragment")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", errors.New("is not a valid URL")
	}
	if err := requireSecureOrigin(parsed); err != nil {
		return "", err
	}
	if parsed.Path != "" {
		return "", errors.New("must not have a path or trailing slash")
	}
	return raw, nil
}

func validateMCPResource(raw string) (string, error) {
	normalized, err := utils.NormalizeResource(raw)
	if err != nil {
		return "", err
	}
	if normalized != raw {
		return "", fmt.Errorf("must be normalized, use %q", normalized)
	}
	parsed, err := url.Parse(normalized)
	if err != nil {
		return "", errors.New("is not a valid URL")
	}
	if err := requireSecureOrigin(parsed); err != nil {
		return "", err
	}
	return normalized, nil
}

func requireSecureOrigin(parsed *url.URL) error {
	if parsed.Hostname() == "" {
		return errors.New("must be an absolute URL with a host")
	}
	if parsed.User != nil {
		return errors.New("must not contain credentials")
	}
	switch parsed.Scheme {
	case "https":
		return nil
	case "http":
		if utils.IsLoopbackHost(parsed.Hostname()) {
			return nil
		}
		return errors.New("must use https (http is only allowed for loopback hosts)")
	default:
		return errors.New("must use the https scheme")
	}
}

func durationFromEnv(name string, fallback time.Duration) (time.Duration, error) {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("%s is not a valid duration: %w", name, err)
	}
	if parsed <= 0 {
		return 0, fmt.Errorf("%s must be greater than zero", name)
	}
	return parsed, nil
}
