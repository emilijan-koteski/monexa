package requests

import "github.com/emilijan-koteski/monexa/internal/models/types"

type GroupRequest struct {
	Name          *string             `json:"name"`
	Icon          *string             `json:"icon"`
	Color         *string             `json:"color"`
	BaseCurrency  *types.CurrencyType `json:"baseCurrency"`
	StartDate     *string             `json:"startDate"`
	EndDate       *string             `json:"endDate"`
	SimplifyDebts *bool               `json:"simplifyDebts"`
	Archived      *bool               `json:"archived"`
	GuestNames    []string            `json:"guestNames"`
}

type GroupMemberRequest struct {
	DisplayName *string                `json:"displayName"`
	Role        *types.GroupMemberRole `json:"role"`
}

type GroupJoinRequest struct {
	MemberID    *uint   `json:"memberId"`
	DisplayName *string `json:"displayName"`
}

type GroupSyncRequest struct {
	Enabled         bool  `json:"enabled"`
	CategoryID      *uint `json:"categoryId"`
	PaymentMethodID *uint `json:"paymentMethodId"`
	KeepRecords     *bool `json:"keepRecords"`
}

type GroupMeRequest struct {
	DisplayName *string           `json:"displayName"`
	Sync        *GroupSyncRequest `json:"sync"`
}
