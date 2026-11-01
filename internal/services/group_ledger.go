package services

import (
	"fmt"
	"sort"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
)

type ledgerShare struct {
	ShareID   uint
	MemberID  uint
	OrigCents int64
	BaseCents int64
}

type ledgerExpense struct {
	Expense   models.GroupExpense
	Pending   bool
	BaseCents int64
	Shares    []ledgerShare
}

type groupLedger struct {
	Group       models.Group
	Members     []models.GroupMember
	Expenses    []ledgerExpense
	Settlements []models.GroupSettlement
}

type debtKey struct {
	From uint
	To   uint
}

type balanceSheet struct {
	Net          map[uint]int64
	Paid         map[uint]int64
	Share        map[uint]int64
	PendingCount int
	ExpenseCount int
	Total        int64
	debt         map[debtKey]int64
}

type transfer struct {
	From  uint
	To    uint
	Cents int64
}

// loadGroupLedger reads every member, expense with its shares, and payment of a group, members including removed ones.
func loadGroupLedger(tx *gorm.DB, group *models.Group) (*groupLedger, error) {
	ledger := &groupLedger{Group: *group}
	if err := tx.Unscoped().Where("group_id = ?", group.ID).Order("id").Find(&ledger.Members).Error; err != nil {
		return nil, fmt.Errorf("failed to load members: %w", err)
	}

	var expenses []models.GroupExpense
	if err := tx.Preload("Shares", func(db *gorm.DB) *gorm.DB { return db.Order("member_id") }).
		Where("group_id = ?", group.ID).
		Order("date DESC, id DESC").
		Find(&expenses).Error; err != nil {
		return nil, fmt.Errorf("failed to load expenses: %w", err)
	}
	for _, expense := range expenses {
		ledger.Expenses = append(ledger.Expenses, toLedgerExpense(expense))
	}

	if err := tx.Where("group_id = ?", group.ID).Order("date DESC, id DESC").Find(&ledger.Settlements).Error; err != nil {
		return nil, fmt.Errorf("failed to load payments: %w", err)
	}
	return ledger, nil
}

func toLedgerExpense(expense models.GroupExpense) ledgerExpense {
	item := ledgerExpense{Expense: expense, Pending: expense.Amount == nil || expense.BaseAmount == nil}
	if !item.Pending {
		item.BaseCents = utils.ToCents(*expense.BaseAmount)
	}
	for _, share := range expense.Shares {
		ls := ledgerShare{ShareID: share.ID, MemberID: share.MemberID}
		if share.Amount != nil {
			ls.OrigCents = utils.ToCents(*share.Amount)
		}
		if share.BaseAmount != nil {
			ls.BaseCents = utils.ToCents(*share.BaseAmount)
		}
		item.Shares = append(item.Shares, ls)
	}
	return item
}

// computeBalances nets every known expense share against its payer and every payment against its receiver.
func computeBalances(ledger *groupLedger) *balanceSheet {
	sheet := &balanceSheet{
		Net:   map[uint]int64{},
		Paid:  map[uint]int64{},
		Share: map[uint]int64{},
		debt:  map[debtKey]int64{},
	}
	for _, item := range ledger.Expenses {
		sheet.ExpenseCount++
		if item.Pending {
			sheet.PendingCount++
			continue
		}
		payer := item.Expense.PaidByMemberID
		sheet.Total += item.BaseCents
		sheet.Paid[payer] += item.BaseCents
		for _, share := range item.Shares {
			sheet.Share[share.MemberID] += share.BaseCents
			if share.MemberID == payer {
				continue
			}
			sheet.Net[payer] += share.BaseCents
			sheet.Net[share.MemberID] -= share.BaseCents
			sheet.debt[debtKey{From: share.MemberID, To: payer}] += share.BaseCents
		}
	}
	for _, settlement := range ledger.Settlements {
		cents := utils.ToCents(settlement.BaseAmount)
		sheet.Net[settlement.FromMemberID] += cents
		sheet.Net[settlement.ToMemberID] -= cents
		sheet.debt[debtKey{From: settlement.FromMemberID, To: settlement.ToMemberID}] -= cents
	}
	return sheet
}

// Pair returns how much a owes c after everything between the two of them; negative means c owes a.
func (b *balanceSheet) Pair(a, c uint) int64 {
	return b.debt[debtKey{From: a, To: c}] - b.debt[debtKey{From: c, To: a}]
}

// settleThreshold is the smallest balance worth paying back; anything below it counts as settled.
func settleThreshold(currency types.CurrencyType) int64 {
	switch currency {
	case types.MacedonianDenar, types.SerbianDinar, types.HungarianForint:
		return 100
	default:
		return 1
	}
}

func roundToSettled(cents, threshold int64) int64 {
	if cents > -threshold && cents < threshold {
		return 0
	}
	return cents
}

type pendingBalance struct {
	member uint
	cents  int64
}

func sortBalances(list []pendingBalance) {
	sort.SliceStable(list, func(i, j int) bool {
		if list[i].cents != list[j].cents {
			return list[i].cents > list[j].cents
		}
		return list[i].member < list[j].member
	})
}

// suggestTransfers lists who should pay whom: the fewest payments when simplify is on, otherwise each pair settles directly.
func suggestTransfers(sheet *balanceSheet, memberIDs []uint, simplify bool, threshold int64) []transfer {
	var transfers []transfer
	if !simplify {
		for i := 0; i < len(memberIDs); i++ {
			for j := i + 1; j < len(memberIDs); j++ {
				a, c := memberIDs[i], memberIDs[j]
				owed := roundToSettled(sheet.Pair(a, c), threshold)
				switch {
				case owed > 0:
					transfers = append(transfers, transfer{From: a, To: c, Cents: owed})
				case owed < 0:
					transfers = append(transfers, transfer{From: c, To: a, Cents: -owed})
				}
			}
		}
		return transfers
	}

	var creditors, debtors []pendingBalance
	for _, id := range memberIDs {
		net := roundToSettled(sheet.Net[id], threshold)
		switch {
		case net > 0:
			creditors = append(creditors, pendingBalance{member: id, cents: net})
		case net < 0:
			debtors = append(debtors, pendingBalance{member: id, cents: -net})
		}
	}
	sortBalances(creditors)
	sortBalances(debtors)
	for len(creditors) > 0 && len(debtors) > 0 {
		amount := min(creditors[0].cents, debtors[0].cents)
		if amount >= threshold {
			transfers = append(transfers, transfer{From: debtors[0].member, To: creditors[0].member, Cents: amount})
		}
		creditors[0].cents -= amount
		debtors[0].cents -= amount
		if creditors[0].cents < threshold {
			creditors = creditors[1:]
		}
		if len(debtors) > 0 && debtors[0].cents < threshold {
			debtors = debtors[1:]
		}
		sortBalances(creditors)
		sortBalances(debtors)
	}
	return transfers
}
