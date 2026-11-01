package responses

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type GroupMemberResponse struct {
	ID          uint                  `json:"id"`
	DisplayName string                `json:"displayName"`
	Role        types.GroupMemberRole `json:"role"`
	IsLinked    bool                  `json:"isLinked"`
	IsMe        bool                  `json:"isMe"`
	LinkedAt    *time.Time            `json:"linkedAt"`
}

type GroupMembershipResponse struct {
	MemberID            uint                  `json:"memberId"`
	Role                types.GroupMemberRole `json:"role"`
	SyncEnabled         bool                  `json:"syncEnabled"`
	SyncCategoryID      *uint                 `json:"syncCategoryId"`
	SyncPaymentMethodID *uint                 `json:"syncPaymentMethodId"`
	SyncedRecordCount   int64                 `json:"syncedRecordCount"`
	KeptRecordCount     int64                 `json:"keptRecordCount"`
}

type GroupResponse struct {
	ID            uint                    `json:"id"`
	CreatedAt     time.Time               `json:"createdAt"`
	Name          string                  `json:"name"`
	Icon          string                  `json:"icon"`
	Color         string                  `json:"color"`
	BaseCurrency  types.CurrencyType      `json:"baseCurrency"`
	StartDate     *time.Time              `json:"startDate"`
	EndDate       *time.Time              `json:"endDate"`
	SimplifyDebts bool                    `json:"simplifyDebts"`
	ArchivedAt    *time.Time              `json:"archivedAt"`
	InviteCode    *string                 `json:"inviteCode"`
	HasActivity   bool                    `json:"hasActivity"`
	Members       []GroupMemberResponse   `json:"members"`
	Me            GroupMembershipResponse `json:"me"`
}

type GroupSummaryResponse struct {
	ID           uint                  `json:"id"`
	Name         string                `json:"name"`
	Icon         string                `json:"icon"`
	Color        string                `json:"color"`
	BaseCurrency types.CurrencyType    `json:"baseCurrency"`
	StartDate    *time.Time            `json:"startDate"`
	EndDate      *time.Time            `json:"endDate"`
	ArchivedAt   *time.Time            `json:"archivedAt"`
	Members      []GroupMemberResponse `json:"members"`
	MyNet        float64               `json:"myNet"`
	PendingCount int                   `json:"pendingCount"`
	ExpenseCount int                   `json:"expenseCount"`
}

type GroupJoinGuestResponse struct {
	ID          uint   `json:"id"`
	DisplayName string `json:"displayName"`
}

type GroupJoinPreviewResponse struct {
	GroupID       uint                     `json:"groupId"`
	Name          string                   `json:"name"`
	Icon          string                   `json:"icon"`
	Color         string                   `json:"color"`
	BaseCurrency  types.CurrencyType       `json:"baseCurrency"`
	StartDate     *time.Time               `json:"startDate"`
	EndDate       *time.Time               `json:"endDate"`
	MemberCount   int                      `json:"memberCount"`
	Guests        []GroupJoinGuestResponse `json:"guests"`
	AlreadyMember bool                     `json:"alreadyMember"`
	SuggestedName string                   `json:"suggestedName"`
}

type GroupJoinResponse struct {
	GroupID  uint `json:"groupId"`
	MemberID uint `json:"memberId"`
}
