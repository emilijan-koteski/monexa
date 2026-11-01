package models

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
	"gorm.io/gorm"
)

type GroupMember struct {
	ID                  uint                  `gorm:"primaryKey" json:"id"`
	CreatedAt           time.Time             `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt           *time.Time            `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt           gorm.DeletedAt        `gorm:"index" json:"-"`
	GroupID             uint                  `gorm:"not null;index" json:"groupId"`
	UserID              *uint                 `gorm:"index" json:"-"`
	DisplayName         string                `gorm:"not null" json:"displayName"`
	Role                types.GroupMemberRole `gorm:"not null" json:"role"`
	LinkedAt            *time.Time            `json:"linkedAt"`
	SyncEnabled         bool                  `gorm:"not null" json:"-"`
	SyncCategoryID      *uint                 `json:"-"`
	SyncPaymentMethodID *uint                 `json:"-"`
}
