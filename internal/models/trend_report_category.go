package models

type TrendReportCategory struct {
	TrendReportID uint `gorm:"primaryKey"`
	CategoryID    uint `gorm:"primaryKey"`
}
