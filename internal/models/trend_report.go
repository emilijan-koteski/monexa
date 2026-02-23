package models

import (
	"time"

	"gorm.io/gorm"
)

type TrendReport struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	UserID      uint           `gorm:"index;not null" json:"userId"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   *time.Time     `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Title       *string        `json:"title"`
	Description *string        `json:"description"`
	Color       *string        `json:"color"`

	Categories []Category `gorm:"many2many:trend_report_categories;" json:"categories"`
}
