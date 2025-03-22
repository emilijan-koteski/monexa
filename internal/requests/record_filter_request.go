package requests

import (
	"time"
)

type RecordFilterRequest struct {
	UserID    *uint
	StartDate *time.Time `query:"startDate"`
	EndDate   *time.Time `query:"endDate"`
}
