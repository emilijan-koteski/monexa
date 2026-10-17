package clients

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"syscall"
	"time"
	"unicode/utf8"

	"github.com/emilijan-koteski/monexa/internal/utils"
)

const (
	cimdAllowedPort        = "443"
	cimdFetchTimeout       = 5 * time.Second
	cimdMaxBodyBytes       = 5 * 1024
	cimdMaxHeaderBytes     = 8 * 1024
	cimdMaxRedirectURIs    = 5
	cimdMaxClientNameRunes = 100
	cimdUserAgent          = "monexa-oauth/1"
	cimdJSONMediaType      = "application/json"
	cimdAuthMethodNone     = "none"
)

var errCIMDDialBlocked = errors.New("cimd: dial blocked")

type CIMDDocument struct {
	ClientID                          string   `json:"client_id"`
	ClientName                        string   `json:"client_name"`
	RedirectURIs                      []string `json:"redirect_uris"`
	ClientURI                         *string  `json:"client_uri,omitempty"`
	LogoURI                           *string  `json:"logo_uri,omitempty"`
	TokenEndpointAuthMethod           string   `json:"token_endpoint_auth_method"`
	TokenEndpointAuthMethodsSupported []string `json:"token_endpoint_auth_methods_supported,omitempty"`
}

type cimdPolicy struct {
	isDisallowedHost func(host string) bool
	allowedPort      string
	rootCAs          *x509.CertPool
	timeout          time.Duration
}

type CIMDClient struct {
	policy     cimdPolicy
	httpClient *http.Client
}

func strictCIMDPolicy() cimdPolicy {
	return cimdPolicy{
		isDisallowedHost: utils.IsDisallowedIPString,
		allowedPort:      cimdAllowedPort,
		timeout:          cimdFetchTimeout,
	}
}

// guardDial runs after DNS resolution on every connection attempt, so a rebinding hostname cannot reach a blocked address.
func (p cimdPolicy) guardDial(_, address string, _ syscall.RawConn) error {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("%w: unparseable address %q", errCIMDDialBlocked, address)
	}
	if port != p.allowedPort {
		return fmt.Errorf("%w: port %s is not allowed", errCIMDDialBlocked, port)
	}
	if p.isDisallowedHost(host) {
		return fmt.Errorf("%w: address %s is not allowed", errCIMDDialBlocked, host)
	}
	return nil
}

func NewCIMDClient() *CIMDClient {
	return newCIMDClient(strictCIMDPolicy())
}

func newCIMDClient(policy cimdPolicy) *CIMDClient {
	dialer := &net.Dialer{
		Timeout: policy.timeout,
		Control: policy.guardDial,
	}
	transport := &http.Transport{
		Proxy:                  nil,
		DialContext:            dialer.DialContext,
		TLSClientConfig:        &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: policy.rootCAs},
		TLSHandshakeTimeout:    policy.timeout,
		DisableKeepAlives:      true,
		MaxResponseHeaderBytes: cimdMaxHeaderBytes,
	}
	return &CIMDClient{
		policy: policy,
		httpClient: &http.Client{
			Timeout:   policy.timeout,
			Transport: transport,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

func (c *CIMDClient) Fetch(ctx context.Context, clientIDURL string) (*CIMDDocument, error) {
	if err := c.validateClientIDURL(clientIDURL); err != nil {
		return nil, err
	}
	body, err := c.fetchBody(ctx, clientIDURL)
	if err != nil {
		return nil, err
	}
	return parseCIMDDocument(body, clientIDURL)
}

func (c *CIMDClient) validateClientIDURL(raw string) error {
	if strings.Contains(raw, "#") {
		return errors.New("cimd: client_id URL must not contain a fragment")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("cimd: client_id is not a valid URL: %w", err)
	}
	if parsed.Scheme != "https" {
		return errors.New("cimd: client_id URL must use https")
	}
	if parsed.Hostname() == "" {
		return errors.New("cimd: client_id URL must have a host")
	}
	if parsed.User != nil {
		return errors.New("cimd: client_id URL must not contain credentials")
	}
	if port := parsed.Port(); port != "" && port != c.policy.allowedPort {
		return fmt.Errorf("cimd: client_id URL port %s is not allowed", port)
	}
	if parsed.Path == "" || parsed.Path == "/" {
		return errors.New("cimd: client_id URL must have a path")
	}
	if hasDotSegment(parsed.Path) {
		return errors.New("cimd: client_id URL path must not contain dot segments")
	}
	return nil
}

func hasDotSegment(path string) bool {
	for _, segment := range strings.Split(path, "/") {
		if segment == "." || segment == ".." {
			return true
		}
	}
	return false
}

func (c *CIMDClient) fetchBody(ctx context.Context, clientIDURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, clientIDURL, nil)
	if err != nil {
		return nil, fmt.Errorf("cimd: failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", cimdUserAgent)
	req.Header.Set("Accept", cimdJSONMediaType)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cimd: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusMultipleChoices && resp.StatusCode < http.StatusBadRequest {
		return nil, fmt.Errorf("cimd: redirect (status %d) is not followed", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cimd: metadata endpoint returned status %d", resp.StatusCode)
	}
	mediaType, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if err != nil || mediaType != cimdJSONMediaType {
		return nil, fmt.Errorf("cimd: unexpected content type %q", resp.Header.Get("Content-Type"))
	}
	if resp.ContentLength > cimdMaxBodyBytes {
		return nil, fmt.Errorf("cimd: metadata document exceeds %d bytes", cimdMaxBodyBytes)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, cimdMaxBodyBytes+1))
	if err != nil {
		return nil, fmt.Errorf("cimd: failed to read metadata document: %w", err)
	}
	if len(body) > cimdMaxBodyBytes {
		return nil, fmt.Errorf("cimd: metadata document exceeds %d bytes", cimdMaxBodyBytes)
	}
	return body, nil
}

func parseCIMDDocument(body []byte, clientIDURL string) (*CIMDDocument, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil {
		return nil, fmt.Errorf("cimd: metadata document is not a JSON object: %w", err)
	}
	for key := range fields {
		if strings.EqualFold(key, "client_secret") || strings.EqualFold(key, "client_secret_expires_at") {
			return nil, fmt.Errorf("cimd: metadata document must not contain %s", key)
		}
	}

	var doc CIMDDocument
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("cimd: metadata document has invalid fields: %w", err)
	}
	if err := validateCIMDDocument(&doc, clientIDURL); err != nil {
		return nil, err
	}
	return &doc, nil
}

func validateCIMDDocument(doc *CIMDDocument, clientIDURL string) error {
	if doc.ClientID != clientIDURL {
		return errors.New("cimd: client_id in the document does not match the URL it was fetched from")
	}
	if !supportsPublicClientAuth(doc) {
		return fmt.Errorf("cimd: token_endpoint_auth_method %q is not supported", doc.TokenEndpointAuthMethod)
	}
	doc.TokenEndpointAuthMethod = cimdAuthMethodNone
	doc.ClientName = strings.TrimSpace(doc.ClientName)
	if doc.ClientName == "" {
		return errors.New("cimd: client_name is required")
	}
	if utf8.RuneCountInString(doc.ClientName) > cimdMaxClientNameRunes {
		return fmt.Errorf("cimd: client_name exceeds %d characters", cimdMaxClientNameRunes)
	}
	if len(doc.RedirectURIs) == 0 {
		return errors.New("cimd: redirect_uris is required")
	}
	if len(doc.RedirectURIs) > cimdMaxRedirectURIs {
		return fmt.Errorf("cimd: redirect_uris has more than %d entries", cimdMaxRedirectURIs)
	}
	for _, redirectURI := range doc.RedirectURIs {
		if err := utils.ValidateRegisteredRedirectURI(redirectURI); err != nil {
			return fmt.Errorf("cimd: invalid redirect URI %q: %w", redirectURI, err)
		}
	}
	return nil
}

// supportsPublicClientAuth reports whether the client can authenticate with "none", either as its preferred method
// or among the methods it lists as supported (ChatGPT prefers private_key_jwt but also supports none).
func supportsPublicClientAuth(doc *CIMDDocument) bool {
	if doc.TokenEndpointAuthMethod == "" || doc.TokenEndpointAuthMethod == cimdAuthMethodNone {
		return true
	}
	return slices.Contains(doc.TokenEndpointAuthMethodsSupported, cimdAuthMethodNone)
}
