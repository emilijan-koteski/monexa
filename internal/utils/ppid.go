package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strconv"
)

func GeneratePPID(secret string, userID uint) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(strconv.FormatUint(uint64(userID), 10)))
	hash := mac.Sum(nil)
	return base64.RawURLEncoding.EncodeToString(hash[:16])
}
