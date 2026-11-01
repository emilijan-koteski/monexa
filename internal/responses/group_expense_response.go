package responses

import (
	"time"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

type GroupExpenseShareResponse struct {
	ID               uint     `json:"id"`
	MemberID         uint     `json:"memberId"`
	Amount           *float64 `json:"amount"`
	BaseAmount       *float64 `json:"baseAmount"`
	TickSettlementID *uint    `json:"tickSettlementId"`
}

type GroupExpenseResponse struct {
	ID                uint                         `json:"id"`
	CreatedAt         time.Time                    `json:"createdAt"`
	UpdatedAt         *time.Time                   `json:"updatedAt"`
	Title             string                       `json:"title"`
	Pending           bool                         `json:"pending"`
	Amount            *float64                     `json:"amount"`
	Currency          types.CurrencyType           `json:"currency"`
	ExchangeRate      float64                      `json:"exchangeRate"`
	RateIsManual      bool                         `json:"rateIsManual"`
	RateSource        types.ExchangeRateSourceType `json:"rateSource"`
	BaseAmount        *float64                     `json:"baseAmount"`
	Date              time.Time                    `json:"date"`
	Category          types.GroupExpenseCategory   `json:"category"`
	SplitType         types.GroupSplitType         `json:"splitType"`
	PaidByMemberID    uint                         `json:"paidByMemberId"`
	CreatedByMemberID uint                         `json:"createdByMemberId"`
	UpdatedByMemberID *uint                        `json:"updatedByMemberId"`
	Note              *string                      `json:"note"`
	Version           int                          `json:"version"`
	Shares            []GroupExpenseShareResponse  `json:"shares"`
	DetachedTicks     int                          `json:"detachedTicks"`
}

type GroupBalanceMemberResponse struct {
	MemberID uint    `json:"memberId"`
	Paid     float64 `json:"paid"`
	Share    float64 `json:"share"`
	Net      float64 `json:"net"`
}

type GroupTransferResponse struct {
	FromMemberID uint    `json:"fromMemberId"`
	ToMemberID   uint    `json:"toMemberId"`
	Amount       float64 `json:"amount"`
}

type GroupPairResponse struct {
	MemberID uint    `json:"memberId"`
	Amount   float64 `json:"amount"`
}

type GroupBalancesResponse struct {
	Currency     types.CurrencyType           `json:"currency"`
	Simplified   bool                         `json:"simplified"`
	MyMemberID   uint                         `json:"myMemberId"`
	MyNet        float64                      `json:"myNet"`
	Total        float64                      `json:"total"`
	MyShare      float64                      `json:"myShare"`
	MyPaid       float64                      `json:"myPaid"`
	PendingCount int                          `json:"pendingCount"`
	ExpenseCount int                          `json:"expenseCount"`
	Members      []GroupBalanceMemberResponse `json:"members"`
	Suggested    []GroupTransferResponse      `json:"suggested"`
	WithMe       []GroupPairResponse          `json:"withMe"`
}

type GroupCategoryStatResponse struct {
	Category types.GroupExpenseCategory `json:"category"`
	Amount   float64                    `json:"amount"`
	Count    int                        `json:"count"`
}

type GroupPeriodStatResponse struct {
	Period string  `json:"period"`
	Amount float64 `json:"amount"`
}

type GroupStatsResponse struct {
	Currency     types.CurrencyType           `json:"currency"`
	Total        float64                      `json:"total"`
	MyShare      float64                      `json:"myShare"`
	MyPaid       float64                      `json:"myPaid"`
	PerDay       float64                      `json:"perDay"`
	DayCount     int                          `json:"dayCount"`
	PendingCount int                          `json:"pendingCount"`
	ExpenseCount int                          `json:"expenseCount"`
	Granularity  string                       `json:"granularity"`
	ByCategory   []GroupCategoryStatResponse  `json:"byCategory"`
	ByMember     []GroupBalanceMemberResponse `json:"byMember"`
	ByPeriod     []GroupPeriodStatResponse    `json:"byPeriod"`
}
