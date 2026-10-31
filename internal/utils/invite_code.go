package utils

import (
	"crypto/rand"
	"math/big"
	"strings"
)

const (
	inviteCodeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
	inviteCodeLength   = 8
	inviteCodeHalf     = inviteCodeLength / 2
)

// GenerateInviteCode returns an 8-character Crockford base32 code from a cryptographic source.
func GenerateInviteCode() (string, error) {
	var b strings.Builder
	max := big.NewInt(int64(len(inviteCodeAlphabet)))
	for i := 0; i < inviteCodeLength; i++ {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b.WriteByte(inviteCodeAlphabet[n.Int64()])
	}
	return b.String(), nil
}

// NormalizeInviteCode uppercases a typed code, drops separators and maps look-alike letters to digits.
func NormalizeInviteCode(input string) string {
	var b strings.Builder
	for _, r := range strings.ToUpper(input) {
		switch {
		case r == 'O':
			b.WriteRune('0')
		case r == 'I' || r == 'L':
			b.WriteRune('1')
		case (r >= '0' && r <= '9') || (r >= 'A' && r <= 'Z'):
			b.WriteRune(r)
		}
	}
	return b.String()
}

// FormatInviteCode shows a stored code as XXXX-XXXX.
func FormatInviteCode(code string) string {
	if len(code) != inviteCodeLength {
		return code
	}
	return code[:inviteCodeHalf] + "-" + code[inviteCodeHalf:]
}
