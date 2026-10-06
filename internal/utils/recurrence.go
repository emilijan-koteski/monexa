package utils

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

// NextOccurrence returns the next occurrence after current for the given frequency.
// For monthly and yearly frequencies the day is anchored to anchorDay and clamped
// to the last valid day of the target month, preventing drift (e.g. the 31st of
// each month) and overflow (e.g. Feb 29 on non-leap years).
func NextOccurrence(current time.Time, frequency types.FrequencyType, anchorDay int) time.Time {
	switch frequency {
	case types.Daily:
		return current.AddDate(0, 0, 1)
	case types.Weekly:
		return current.AddDate(0, 0, 7)
	case types.Monthly:
		year, month := current.Year(), current.Month()
		if month == time.December {
			year, month = year+1, time.January
		} else {
			month++
		}
		return dateWithClampedDay(year, month, anchorDay, current)
	case types.Yearly:
		return dateWithClampedDay(current.Year()+1, current.Month(), anchorDay, current)
	default:
		return current.AddDate(0, 0, 1)
	}
}

// AdvanceToDate rolls current forward by whole occurrences until it is no longer
// before notBefore, skipping (not generating) the occurrences in between. It is
// used to resume a paused schedule without backfilling the paused interval.
func AdvanceToDate(current time.Time, frequency types.FrequencyType, anchorDay int, notBefore time.Time) time.Time {
	for current.Before(notBefore) {
		current = NextOccurrence(current, frequency, anchorDay)
	}
	return current
}

func dateWithClampedDay(year int, month time.Month, day int, ref time.Time) time.Time {
	if last := daysInMonth(year, month); day > last {
		day = last
	}
	return time.Date(year, month, day, ref.Hour(), ref.Minute(), ref.Second(), ref.Nanosecond(), ref.Location())
}

func daysInMonth(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}
