package requests

import (
	"time"

	dtotypes "github.com/emilijan-koteski/monexa/internal/dtos/types"
)

type ExportRequest struct {
	UserID     uint
	Format     dtotypes.ExportFormatType
	Categories []dtotypes.ExportCategoryType
	StartDate  *time.Time
	EndDate    *time.Time
}
