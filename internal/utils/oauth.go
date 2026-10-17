package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/netip"
	"net/url"
	"strings"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

const (
	AccessTokenPrefix         = "mnx_at_"
	RefreshTokenPrefix        = "mnx_rt_"
	PersonalAccessTokenPrefix = "mnx_pat_"
	AuthorizationCodePrefix   = "mnx_ac_"
)

const (
	opaqueTokenRandomBytes   = 32
	tokenDisplayPrefixLength = 12
	codeVerifierMinLength    = 43
	codeVerifierMaxLength    = 128
	codeChallengeLength      = 43
	scopeSeparator           = " "
)

var canonicalScopeOrder = []types.OAuthScope{types.ScopeRead, types.ScopeWrite, types.ScopeOfflineAccess}

var disallowedPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("::/96"),
	netip.MustParsePrefix("64:ff9b::/96"),
	netip.MustParsePrefix("2002::/16"),
	netip.MustParsePrefix("fec0::/10"),
}

func GenerateOpaqueToken(prefix string) (plaintext string, hash string, err error) {
	random, err := GenerateRandomID(opaqueTokenRandomBytes)
	if err != nil {
		return "", "", err
	}
	plaintext = prefix + random
	return plaintext, HashOpaqueToken(plaintext), nil
}

func HashOpaqueToken(plaintext string) string {
	sum := sha256.Sum256([]byte(plaintext))
	return hex.EncodeToString(sum[:])
}

func TokenDisplayPrefix(plaintext string) string {
	if len(plaintext) <= tokenDisplayPrefixLength {
		return plaintext
	}
	return plaintext[:tokenDisplayPrefixLength]
}

func GenerateRandomID(nBytes int) (string, error) {
	buf := make([]byte, nBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func IsValidCodeVerifier(v string) bool {
	if len(v) < codeVerifierMinLength || len(v) > codeVerifierMaxLength {
		return false
	}
	for i := 0; i < len(v); i++ {
		if !isUnreservedChar(v[i]) {
			return false
		}
	}
	return true
}

func IsValidCodeChallenge(c string) bool {
	if len(c) != codeChallengeLength {
		return false
	}
	for i := 0; i < len(c); i++ {
		if !isBase64URLChar(c[i]) {
			return false
		}
	}
	return true
}

func VerifyPKCES256(verifier, challenge string) bool {
	if !IsValidCodeVerifier(verifier) {
		return false
	}
	sum := sha256.Sum256([]byte(verifier))
	computed := base64.RawURLEncoding.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(computed), []byte(challenge)) == 1
}

func IsLoopbackHost(hostname string) bool {
	return hostname == "127.0.0.1" || hostname == "::1" || hostname == "localhost"
}

func ValidateRegisteredRedirectURI(raw string) error {
	if raw == "" {
		return errors.New("redirect URI is empty")
	}
	if strings.Contains(raw, "*") {
		return errors.New("redirect URI must not contain a wildcard")
	}
	if strings.Contains(raw, "#") {
		return errors.New("redirect URI must not contain a fragment")
	}
	if containsWhitespaceControlOrBackslash(raw) {
		return errors.New("redirect URI must not contain whitespace, control characters or backslashes")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return errors.New("redirect URI is not a valid URL")
	}
	if parsed.Scheme == "" || parsed.Hostname() == "" {
		return errors.New("redirect URI must be an absolute URL with a host")
	}
	if parsed.User != nil {
		return errors.New("redirect URI must not contain credentials")
	}
	switch parsed.Scheme {
	case "https":
		return nil
	case "http":
		if !IsLoopbackHost(parsed.Hostname()) {
			return errors.New("redirect URI must use https unless it targets a loopback host")
		}
		return nil
	default:
		return errors.New("redirect URI scheme must be https, or http for a loopback host")
	}
}

func MatchRedirectURI(registered []string, requested string) bool {
	if strings.Contains(requested, "#") {
		return false
	}
	requestedURL, requestedParses := parseAbsoluteURL(requested)
	for _, candidate := range registered {
		registeredURL, ok := parseAbsoluteURL(candidate)
		if !ok {
			continue
		}
		if !IsLoopbackHost(registeredURL.Hostname()) {
			if candidate == requested {
				return true
			}
			continue
		}
		if requestedParses && loopbackRedirectURIsMatch(registeredURL, requestedURL) {
			return true
		}
	}
	return false
}

func NormalizeResource(raw string) (string, error) {
	if strings.Contains(raw, "#") {
		return "", errors.New("resource must not contain a fragment")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", errors.New("resource is not a valid URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("resource must be an absolute http or https URL")
	}
	if parsed.User != nil {
		return "", errors.New("resource must not contain credentials")
	}
	hostname := strings.ToLower(parsed.Hostname())
	if hostname == "" {
		return "", errors.New("resource must have a host")
	}

	var normalized strings.Builder
	normalized.WriteString(parsed.Scheme)
	normalized.WriteString("://")
	normalized.WriteString(formatHost(hostname, effectivePort(parsed)))
	normalized.WriteString(strings.TrimSuffix(parsed.EscapedPath(), "/"))
	if parsed.RawQuery != "" {
		normalized.WriteString("?")
		normalized.WriteString(parsed.RawQuery)
	}
	return normalized.String(), nil
}

// IsDisallowedIP reports whether the server must never connect to addr.
// IPv4-mapped IPv6 addresses are always blocked; plain IPv4 is classified as IPv4.
func IsDisallowedIP(addr netip.Addr) bool {
	return isDisallowedAddr(addr)
}

// IsDisallowedIPString applies IsDisallowedIP to a textual address such as a dialer's host.
// Zones are ignored and unparseable input is disallowed.
func IsDisallowedIPString(ip string) bool {
	addr, err := netip.ParseAddr(ip)
	if err != nil {
		return true
	}
	return isDisallowedAddr(addr)
}

func ParseScope(raw string) ([]types.OAuthScope, error) {
	scopes := []types.OAuthScope{}
	seen := map[types.OAuthScope]bool{}
	for _, token := range strings.Split(raw, scopeSeparator) {
		if token == "" {
			continue
		}
		scope := types.OAuthScope(token)
		if !types.IsValidOAuthScope(scope) {
			return nil, errors.New("unknown scope: " + token)
		}
		if seen[scope] {
			continue
		}
		seen[scope] = true
		scopes = append(scopes, scope)
	}
	return scopes, nil
}

func FormatScope(scopes []types.OAuthScope) string {
	present := make(map[types.OAuthScope]bool, len(scopes))
	for _, scope := range scopes {
		present[scope] = true
	}
	ordered := make([]string, 0, len(canonicalScopeOrder))
	for _, scope := range canonicalScopeOrder {
		if present[scope] {
			ordered = append(ordered, string(scope))
		}
	}
	return strings.Join(ordered, scopeSeparator)
}

func HasScope(scope string, s types.OAuthScope) bool {
	for _, token := range strings.Split(scope, scopeSeparator) {
		if token != "" && types.OAuthScope(token) == s {
			return true
		}
	}
	return false
}

func isAlphaNumeric(c byte) bool {
	return c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c >= '0' && c <= '9'
}

func isUnreservedChar(c byte) bool {
	return isAlphaNumeric(c) || c == '-' || c == '.' || c == '_' || c == '~'
}

func isBase64URLChar(c byte) bool {
	return isAlphaNumeric(c) || c == '-' || c == '_'
}

func containsWhitespaceControlOrBackslash(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] <= ' ' || s[i] == 0x7f || s[i] == '\\' {
			return true
		}
	}
	return false
}

func parseAbsoluteURL(raw string) (*url.URL, bool) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Hostname() == "" || parsed.User != nil {
		return nil, false
	}
	return parsed, true
}

func loopbackRedirectURIsMatch(registered, requested *url.URL) bool {
	return registered.Scheme == requested.Scheme &&
		registered.Hostname() == requested.Hostname() &&
		registered.EscapedPath() == requested.EscapedPath() &&
		registered.RawQuery == requested.RawQuery &&
		registered.ForceQuery == requested.ForceQuery
}

func effectivePort(parsed *url.URL) string {
	port := parsed.Port()
	if parsed.Scheme == "https" && port == "443" || parsed.Scheme == "http" && port == "80" {
		return ""
	}
	return port
}

func formatHost(hostname, port string) string {
	if strings.Contains(hostname, ":") {
		hostname = "[" + hostname + "]"
	}
	if port == "" {
		return hostname
	}
	return hostname + ":" + port
}

func isDisallowedAddr(addr netip.Addr) bool {
	addr = addr.WithZone("")
	if !addr.IsValid() || addr.Is4In6() {
		return true
	}
	if addr.IsLoopback() || addr.IsUnspecified() || addr.IsPrivate() || addr.IsMulticast() ||
		addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() || addr.IsInterfaceLocalMulticast() {
		return true
	}
	for _, prefix := range disallowedPrefixes {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}
