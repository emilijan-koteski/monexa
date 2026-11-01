package utils

import (
	"errors"
	"time"
)

const dayLayout = "2006-01-02"

var ErrInvalidDate = errors.New("invalid date, use YYYY-MM-DD or RFC 3339")

// ParseDay accepts YYYY-MM-DD or an RFC 3339 timestamp and returns that day at 12:00 UTC.
func ParseDay(value string) (time.Time, error) {
	if t, err := time.Parse(dayLayout, value); err == nil {
		return NoonUTC(t), nil
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return NoonUTC(t), nil
	}
	return time.Time{}, ErrInvalidDate
}

// NoonUTC moves a timestamp to 12:00 UTC on the same calendar day, so day-based dates never shift across time zones.
func NoonUTC(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 12, 0, 0, 0, time.UTC)
}
