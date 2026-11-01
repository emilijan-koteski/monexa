package requests

import "github.com/emilijan-koteski/monexa/internal/models/types"

type GroupExpenseShareRequest struct {
	MemberID uint     `json:"memberId"`
	Amount   *float64 `json:"amount"`
}

type GroupExpenseRequest struct {
	ClientID       *string                     `json:"clientId"`
	Version        *int                        `json:"version"`
	Title          *string                     `json:"title"`
	Pending        bool                        `json:"pending"`
	Amount         *float64                    `json:"amount"`
	Currency       *types.CurrencyType         `json:"currency"`
	ExchangeRate   *float64                    `json:"exchangeRate"`
	Date           *string                     `json:"date"`
	Category       *types.GroupExpenseCategory `json:"category"`
	SplitType      *types.GroupSplitType       `json:"splitType"`
	PaidByMemberID *uint                       `json:"paidByMemberId"`
	Shares         []GroupExpenseShareRequest  `json:"shares"`
	Note           *string                     `json:"note"`
}

type GroupSettlementRequest struct {
	ClientID     *string             `json:"clientId"`
	ShareID      *uint               `json:"shareId"`
	FromMemberID *uint               `json:"fromMemberId"`
	ToMemberID   *uint               `json:"toMemberId"`
	Amount       *float64            `json:"amount"`
	Currency     *types.CurrencyType `json:"currency"`
	ExchangeRate *float64            `json:"exchangeRate"`
	Date         *string             `json:"date"`
	Note         *string             `json:"note"`
}
