package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	dtoResponses "github.com/emilijan-koteski/monexa/internal/responses"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
)

const (
	maxExpenseTitleLength = 80
	maxNoteLength         = 500
	maxDailyStatsSpan     = 62
)

var clientIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type GroupExpenseService struct {
	db              *gorm.DB
	currencyService *CurrencyService
}

func NewGroupExpenseService(db *gorm.DB, currencyService *CurrencyService) *GroupExpenseService {
	return &GroupExpenseService{db: db, currencyService: currencyService}
}

type preparedShare struct {
	MemberID  uint
	OrigCents *int64
	BaseCents *int64
}

type preparedExpense struct {
	Title       string
	Pending     bool
	AmountCents int64
	Currency    types.CurrencyType
	Rate        float64
	RateManual  bool
	RateSource  types.ExchangeRateSourceType
	BaseCents   int64
	Date        time.Time
	Category    types.GroupExpenseCategory
	SplitType   types.GroupSplitType
	PayerID     uint
	Note        *string
	Shares      []preparedShare
}

func activeMembersByID(tx *gorm.DB, groupID uint) (map[uint]*models.GroupMember, error) {
	members, err := loadMembers(tx, groupID)
	if err != nil {
		return nil, err
	}
	byID := make(map[uint]*models.GroupMember, len(members))
	for i := range members {
		byID[members[i].ID] = &members[i]
	}
	return byID, nil
}

func cleanNote(note *string) (*string, error) {
	if note == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*note)
	if trimmed == "" {
		return nil, nil
	}
	if utf8.RuneCountInString(trimmed) > maxNoteLength {
		return nil, validationError("the note can be at most %d characters", maxNoteLength)
	}
	return &trimmed, nil
}

func cleanClientID(clientID *string) (*string, error) {
	if clientID == nil || *clientID == "" {
		return nil, nil
	}
	if !clientIDPattern.MatchString(*clientID) {
		return nil, validationError("clientId must be a UUID")
	}
	lower := strings.ToLower(*clientID)
	return &lower, nil
}

func int64Ptr(v int64) *int64 {
	return &v
}

// resolveRate picks the expense's rate: 1 for the group currency, a manual rate when given, the frozen rate of an unchanged edit, otherwise the market rate for the date.
func (s *GroupExpenseService) resolveRate(ctx context.Context, group *models.Group, currency types.CurrencyType, date time.Time, manual *float64, existing *models.GroupExpense) (float64, bool, types.ExchangeRateSourceType, error) {
	if currency == group.BaseCurrency {
		return 1, false, types.Identity, nil
	}
	if manual != nil {
		if *manual <= 0 {
			return 0, false, "", validationError("the exchange rate must be above zero")
		}
		return utils.RoundRate(*manual), true, types.ManualRate, nil
	}
	if existing != nil && !existing.RateIsManual && existing.Currency == currency && existing.Date.Equal(date) && existing.ExchangeRate > 0 {
		return existing.ExchangeRate, false, existing.RateSource, nil
	}
	quote, err := s.currencyService.GetRate(ctx, date, currency, group.BaseCurrency)
	if err != nil {
		return 0, false, "", err
	}
	return utils.RoundRate(quote.Rate), false, quote.Source, nil
}

func (s *GroupExpenseService) prepareExpense(ctx context.Context, tx *gorm.DB, group *models.Group, members map[uint]*models.GroupMember, req requests.GroupExpenseRequest, existing *models.GroupExpense) (*preparedExpense, error) {
	if req.Title == nil {
		return nil, validationError("title is required")
	}
	title, err := cleanName(*req.Title, "title", maxExpenseTitleLength)
	if err != nil {
		return nil, err
	}
	currency := group.BaseCurrency
	if req.Currency != nil {
		currency = *req.Currency
	}
	if !types.IsValidCurrencyType(currency) {
		return nil, validationError("unsupported currency")
	}
	if req.Date == nil {
		return nil, validationError("date is required")
	}
	date, err := utils.ParseDay(*req.Date)
	if err != nil {
		return nil, validationError("%s", err.Error())
	}
	category := types.GroupOther
	if req.Category != nil {
		category = *req.Category
	}
	if !types.IsValidGroupExpenseCategory(category) {
		return nil, validationError("unknown category")
	}
	splitType := types.SplitEqual
	if req.SplitType != nil {
		splitType = *req.SplitType
	}
	if !types.IsValidGroupSplitType(splitType) {
		return nil, validationError("unknown split type")
	}
	if req.PaidByMemberID == nil || members[*req.PaidByMemberID] == nil {
		return nil, validationError("pick who paid")
	}
	note, err := cleanNote(req.Note)
	if err != nil {
		return nil, err
	}
	if req.Pending && splitType == types.SplitExact {
		return nil, validationError("exact amounts need the total; split equally while the amount is missing")
	}

	memberIDs := make([]uint, 0, len(req.Shares))
	seen := map[uint]bool{}
	exact := map[uint]int64{}
	for _, share := range req.Shares {
		if members[share.MemberID] == nil {
			return nil, validationError("everyone in the split must be in the group")
		}
		if seen[share.MemberID] {
			return nil, validationError("a person is in the split twice")
		}
		seen[share.MemberID] = true
		memberIDs = append(memberIDs, share.MemberID)
		if splitType == types.SplitExact {
			if share.Amount == nil || *share.Amount < 0 {
				return nil, validationError("every exact share needs an amount")
			}
			exact[share.MemberID] = utils.ToCents(*share.Amount)
		}
	}
	if len(memberIDs) == 0 {
		return nil, validationError("pick at least one person to split with")
	}
	sort.Slice(memberIDs, func(i, j int) bool { return memberIDs[i] < memberIDs[j] })

	rate, rateManual, rateSource, err := s.resolveRate(ctx, group, currency, date, req.ExchangeRate, existing)
	if err != nil {
		return nil, err
	}

	prepared := &preparedExpense{
		Title:      title,
		Pending:    req.Pending,
		Currency:   currency,
		Rate:       rate,
		RateManual: rateManual,
		RateSource: rateSource,
		Date:       date,
		Category:   category,
		SplitType:  splitType,
		PayerID:    *req.PaidByMemberID,
		Note:       note,
	}
	if req.Pending {
		for _, id := range memberIDs {
			prepared.Shares = append(prepared.Shares, preparedShare{MemberID: id})
		}
		return prepared, nil
	}

	if req.Amount == nil || utils.ToCents(*req.Amount) <= 0 {
		return nil, validationError("the amount must be above zero")
	}
	prepared.AmountCents = utils.ToCents(*req.Amount)

	orig := make([]int64, len(memberIDs))
	if splitType == types.SplitExact {
		var sum int64
		for i, id := range memberIDs {
			orig[i] = exact[id]
			sum += orig[i]
		}
		if sum != prepared.AmountCents {
			return nil, validationError("the exact amounts must add up to the total")
		}
	} else {
		ones := make([]int64, len(memberIDs))
		for i := range ones {
			ones[i] = 1
		}
		orig = utils.Allocate(prepared.AmountCents, ones, memberIDs)
	}

	prepared.BaseCents = utils.ConvertCents(prepared.AmountCents, rate)
	base := utils.Allocate(prepared.BaseCents, orig, memberIDs)
	for i, id := range memberIDs {
		if splitType == types.SplitExact && orig[i] == 0 {
			continue
		}
		prepared.Shares = append(prepared.Shares, preparedShare{MemberID: id, OrigCents: int64Ptr(orig[i]), BaseCents: int64Ptr(base[i])})
	}
	return prepared, nil
}

func centsPtrToFloat(cents *int64) *float64 {
	if cents == nil {
		return nil
	}
	v := utils.FromCents(*cents)
	return &v
}

func expenseColumns(p *preparedExpense) map[string]any {
	columns := map[string]any{
		"title":             p.Title,
		"currency":          p.Currency,
		"exchange_rate":     p.Rate,
		"rate_is_manual":    p.RateManual,
		"rate_source":       p.RateSource,
		"date":              p.Date,
		"category":          p.Category,
		"split_type":        p.SplitType,
		"paid_by_member_id": p.PayerID,
		"note":              p.Note,
		"amount":            nil,
		"base_amount":       nil,
	}
	if !p.Pending {
		columns["amount"] = utils.FromCents(p.AmountCents)
		columns["base_amount"] = utils.FromCents(p.BaseCents)
	}
	return columns
}

// writeSharesTx upserts one share per member so share ids stay stable, and deletes shares of people taken out of the split.
func writeSharesTx(tx *gorm.DB, expenseID uint, prepared []preparedShare) ([]models.GroupExpenseShare, error) {
	var existing []models.GroupExpenseShare
	if err := tx.Where("expense_id = ?", expenseID).Find(&existing).Error; err != nil {
		return nil, fmt.Errorf("failed to load shares: %w", err)
	}
	byMember := map[uint]models.GroupExpenseShare{}
	for _, share := range existing {
		byMember[share.MemberID] = share
	}

	keep := map[uint]bool{}
	for _, p := range prepared {
		keep[p.MemberID] = true
		values := map[string]any{"amount": centsPtrToFloat(p.OrigCents), "base_amount": centsPtrToFloat(p.BaseCents)}
		if current, ok := byMember[p.MemberID]; ok {
			if err := tx.Model(&models.GroupExpenseShare{}).Where("id = ?", current.ID).Updates(values).Error; err != nil {
				return nil, fmt.Errorf("failed to update share: %w", err)
			}
			continue
		}
		share := models.GroupExpenseShare{ExpenseID: expenseID, MemberID: p.MemberID, Amount: centsPtrToFloat(p.OrigCents), BaseAmount: centsPtrToFloat(p.BaseCents)}
		if err := tx.Create(&share).Error; err != nil {
			return nil, fmt.Errorf("failed to create share: %w", err)
		}
	}

	var removed []uint
	for _, share := range existing {
		if !keep[share.MemberID] {
			removed = append(removed, share.ID)
		}
	}
	if len(removed) > 0 {
		if err := dropShareRecordsTx(tx, removed); err != nil {
			return nil, err
		}
		if err := tx.Where("id IN ?", removed).Delete(&models.GroupExpenseShare{}).Error; err != nil {
			return nil, fmt.Errorf("failed to remove shares: %w", err)
		}
	}

	var shares []models.GroupExpenseShare
	if err := tx.Where("expense_id = ?", expenseID).Order("member_id").Find(&shares).Error; err != nil {
		return nil, fmt.Errorf("failed to reload shares: %w", err)
	}
	return shares, nil
}

// detachChangedTicksTx unticks items whose share no longer matches the payment that ticked it; the payment itself stays, because the money moved.
func detachChangedTicksTx(tx *gorm.DB, expense *models.GroupExpense, shares []models.GroupExpenseShare) (int, error) {
	if len(shares) == 0 {
		return 0, nil
	}
	byID := map[uint]models.GroupExpenseShare{}
	ids := make([]uint, 0, len(shares))
	for _, share := range shares {
		byID[share.ID] = share
		ids = append(ids, share.ID)
	}
	var ticks []models.GroupSettlement
	if err := tx.Where("share_id IN ?", ids).Find(&ticks).Error; err != nil {
		return 0, fmt.Errorf("failed to load ticked items: %w", err)
	}
	detached := 0
	for _, tick := range ticks {
		share := byID[*tick.ShareID]
		still := expense.Amount != nil &&
			share.MemberID != expense.PaidByMemberID &&
			tick.FromMemberID == share.MemberID &&
			tick.ToMemberID == expense.PaidByMemberID &&
			utils.ToCents(tick.BaseAmount) == shareCents(share.BaseAmount)
		if still {
			continue
		}
		if err := tx.Model(&models.GroupSettlement{}).Where("id = ?", tick.ID).Update("share_id", nil).Error; err != nil {
			return 0, fmt.Errorf("failed to untick item: %w", err)
		}
		detached++
	}
	return detached, nil
}

func previousDescriptions(group *models.Group, expense *models.GroupExpense, shares []models.GroupExpenseShare) map[uint]string {
	out := map[uint]string{}
	for _, share := range shares {
		out[share.MemberID] = syncDescription(group, expense)
	}
	return out
}

func loadExpense(tx *gorm.DB, groupID, expenseID uint) (*models.GroupExpense, error) {
	var expense models.GroupExpense
	err := tx.Preload("Shares", func(db *gorm.DB) *gorm.DB { return db.Order("member_id") }).
		Where("id = ? AND group_id = ?", expenseID, groupID).First(&expense).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrExpenseNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load expense: %w", err)
	}
	return &expense, nil
}

func (s *GroupExpenseService) Create(ctx context.Context, groupID, userID uint, req requests.GroupExpenseRequest) (*dtoResponses.GroupExpenseResponse, error) {
	var result *dtoResponses.GroupExpenseResponse
	err := withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireActive(group); err != nil {
			return err
		}
		clientID, err := cleanClientID(req.ClientID)
		if err != nil {
			return err
		}
		if clientID != nil {
			var replay models.GroupExpense
			if err := tx.Where("group_id = ? AND client_id = ?", group.ID, *clientID).First(&replay).Error; err == nil {
				result, err = expenseResponse(tx, group.ID, replay.ID, 0)
				return err
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("failed to check for a repeated request: %w", err)
			}
		}

		members, err := activeMembersByID(tx, group.ID)
		if err != nil {
			return err
		}
		prepared, err := s.prepareExpense(ctx, tx, group, members, req, nil)
		if err != nil {
			return err
		}
		expense := models.GroupExpense{
			GroupID:           group.ID,
			ClientID:          clientID,
			Title:             prepared.Title,
			Currency:          prepared.Currency,
			ExchangeRate:      prepared.Rate,
			RateIsManual:      prepared.RateManual,
			RateSource:        prepared.RateSource,
			Date:              prepared.Date,
			Category:          prepared.Category,
			SplitType:         prepared.SplitType,
			PaidByMemberID:    prepared.PayerID,
			CreatedByMemberID: me.ID,
			Note:              prepared.Note,
			Version:           1,
		}
		if !prepared.Pending {
			expense.Amount = centsPtrToFloat(&prepared.AmountCents)
			expense.BaseAmount = centsPtrToFloat(&prepared.BaseCents)
		}
		if err := tx.Omit("Shares").Create(&expense).Error; err != nil {
			return fmt.Errorf("failed to create expense: %w", err)
		}
		saved, err := loadExpense(tx, group.ID, expense.ID)
		if err != nil {
			return err
		}
		shares, err := writeSharesTx(tx, saved.ID, prepared.Shares)
		if err != nil {
			return err
		}
		if err := syncExpenseRecordsTx(tx, group, saved, shares, members, nil); err != nil {
			return err
		}
		result, err = expenseResponse(tx, group.ID, saved.ID, 0)
		return err
	})
	return result, err
}

func (s *GroupExpenseService) Update(ctx context.Context, groupID, expenseID, userID uint, req requests.GroupExpenseRequest) (*dtoResponses.GroupExpenseResponse, error) {
	var result *dtoResponses.GroupExpenseResponse
	err := withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireActive(group); err != nil {
			return err
		}
		current, err := loadExpense(tx, group.ID, expenseID)
		if err != nil {
			return err
		}
		if req.Version == nil {
			return validationError("version is required")
		}
		if *req.Version != current.Version {
			return ErrVersionConflict
		}
		members, err := activeMembersByID(tx, group.ID)
		if err != nil {
			return err
		}
		prepared, err := s.prepareExpense(ctx, tx, group, members, req, current)
		if err != nil {
			return err
		}
		previous := previousDescriptions(group, current, current.Shares)

		columns := expenseColumns(prepared)
		columns["version"] = current.Version + 1
		columns["updated_by_member_id"] = me.ID
		update := tx.Model(&models.GroupExpense{}).Where("id = ? AND version = ?", current.ID, current.Version).Updates(columns)
		if update.Error != nil {
			return fmt.Errorf("failed to update expense: %w", update.Error)
		}
		if update.RowsAffected == 0 {
			return ErrVersionConflict
		}

		saved, err := loadExpense(tx, group.ID, current.ID)
		if err != nil {
			return err
		}
		shares, err := writeSharesTx(tx, saved.ID, prepared.Shares)
		if err != nil {
			return err
		}
		detached, err := detachChangedTicksTx(tx, saved, shares)
		if err != nil {
			return err
		}
		if err := syncExpenseRecordsTx(tx, group, saved, shares, members, previous); err != nil {
			return err
		}
		result, err = expenseResponse(tx, group.ID, saved.ID, detached)
		return err
	})
	return result, err
}

func (s *GroupExpenseService) Delete(ctx context.Context, groupID, expenseID, userID uint, version *int, removeSettlements bool) error {
	return withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireActive(group); err != nil {
			return err
		}
		current, err := loadExpense(tx, group.ID, expenseID)
		if err != nil {
			return err
		}
		if version != nil && *version != current.Version {
			return ErrVersionConflict
		}
		shareIDs := make([]uint, 0, len(current.Shares))
		for _, share := range current.Shares {
			shareIDs = append(shareIDs, share.ID)
		}
		if len(shareIDs) > 0 {
			ticks := tx.Model(&models.GroupSettlement{}).Where("share_id IN ?", shareIDs)
			if removeSettlements {
				if err := ticks.Delete(&models.GroupSettlement{}).Error; err != nil {
					return fmt.Errorf("failed to remove tick-off payments: %w", err)
				}
			} else if err := ticks.Update("share_id", nil).Error; err != nil {
				return fmt.Errorf("failed to keep tick-off payments: %w", err)
			}
			if err := dropShareRecordsTx(tx, shareIDs); err != nil {
				return err
			}
		}
		if err := tx.Delete(&models.GroupExpense{}, current.ID).Error; err != nil {
			return fmt.Errorf("failed to delete expense: %w", err)
		}
		return nil
	})
}

func tickMap(tx *gorm.DB, groupID uint) (map[uint]uint, error) {
	var ticks []models.GroupSettlement
	if err := tx.Where("group_id = ? AND share_id IS NOT NULL", groupID).Find(&ticks).Error; err != nil {
		return nil, fmt.Errorf("failed to load ticked items: %w", err)
	}
	out := map[uint]uint{}
	for _, tick := range ticks {
		out[*tick.ShareID] = tick.ID
	}
	return out, nil
}

func toExpenseResponse(expense *models.GroupExpense, ticks map[uint]uint, detached int) dtoResponses.GroupExpenseResponse {
	shares := make([]dtoResponses.GroupExpenseShareResponse, 0, len(expense.Shares))
	for _, share := range expense.Shares {
		item := dtoResponses.GroupExpenseShareResponse{ID: share.ID, MemberID: share.MemberID, Amount: share.Amount, BaseAmount: share.BaseAmount}
		if tickID, ok := ticks[share.ID]; ok {
			id := tickID
			item.TickSettlementID = &id
		}
		shares = append(shares, item)
	}
	return dtoResponses.GroupExpenseResponse{
		ID:                expense.ID,
		CreatedAt:         expense.CreatedAt,
		UpdatedAt:         expense.UpdatedAt,
		Title:             expense.Title,
		Pending:           expense.Amount == nil,
		Amount:            expense.Amount,
		Currency:          expense.Currency,
		ExchangeRate:      expense.ExchangeRate,
		RateIsManual:      expense.RateIsManual,
		RateSource:        expense.RateSource,
		BaseAmount:        expense.BaseAmount,
		Date:              expense.Date,
		Category:          expense.Category,
		SplitType:         expense.SplitType,
		PaidByMemberID:    expense.PaidByMemberID,
		CreatedByMemberID: expense.CreatedByMemberID,
		UpdatedByMemberID: expense.UpdatedByMemberID,
		Note:              expense.Note,
		Version:           expense.Version,
		Shares:            shares,
		DetachedTicks:     detached,
	}
}

func expenseResponse(tx *gorm.DB, groupID, expenseID uint, detached int) (*dtoResponses.GroupExpenseResponse, error) {
	expense, err := loadExpense(tx, groupID, expenseID)
	if err != nil {
		return nil, err
	}
	ticks, err := tickMap(tx, groupID)
	if err != nil {
		return nil, err
	}
	response := toExpenseResponse(expense, ticks, detached)
	return &response, nil
}

func (s *GroupExpenseService) List(ctx context.Context, groupID, userID uint) ([]dtoResponses.GroupExpenseResponse, error) {
	db := s.db.WithContext(ctx)
	if _, err := findMembership(db, groupID, userID); err != nil {
		return nil, err
	}
	var expenses []models.GroupExpense
	if err := db.Preload("Shares", func(q *gorm.DB) *gorm.DB { return q.Order("member_id") }).
		Where("group_id = ?", groupID).
		Order("date DESC, id DESC").
		Find(&expenses).Error; err != nil {
		return nil, fmt.Errorf("failed to load expenses: %w", err)
	}
	ticks, err := tickMap(db, groupID)
	if err != nil {
		return nil, err
	}
	out := make([]dtoResponses.GroupExpenseResponse, 0, len(expenses))
	for i := range expenses {
		out = append(out, toExpenseResponse(&expenses[i], ticks, 0))
	}
	return out, nil
}

func (s *GroupExpenseService) ListSettlements(ctx context.Context, groupID, userID uint) ([]models.GroupSettlement, error) {
	db := s.db.WithContext(ctx)
	if _, err := findMembership(db, groupID, userID); err != nil {
		return nil, err
	}
	settlements := []models.GroupSettlement{}
	if err := db.Where("group_id = ?", groupID).Order("date DESC, id DESC").Find(&settlements).Error; err != nil {
		return nil, fmt.Errorf("failed to load payments: %w", err)
	}
	return settlements, nil
}

func (s *GroupExpenseService) CreateSettlement(ctx context.Context, groupID, userID uint, req requests.GroupSettlementRequest) (*models.GroupSettlement, error) {
	var result models.GroupSettlement
	err := withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireActive(group); err != nil {
			return err
		}
		clientID, err := cleanClientID(req.ClientID)
		if err != nil {
			return err
		}
		if clientID != nil {
			if err := tx.Where("group_id = ? AND client_id = ?", group.ID, *clientID).First(&result).Error; err == nil {
				return nil
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("failed to check for a repeated request: %w", err)
			}
		}
		note, err := cleanNote(req.Note)
		if err != nil {
			return err
		}

		var settlement *models.GroupSettlement
		if req.ShareID != nil {
			settlement, err = tickSettlement(tx, group, *req.ShareID)
		} else {
			settlement, err = s.manualSettlement(ctx, tx, group, req)
		}
		if err != nil {
			return err
		}
		settlement.GroupID = group.ID
		settlement.ClientID = clientID
		settlement.CreatedByMemberID = me.ID
		if note != nil {
			settlement.Note = note
		}
		if err := tx.Create(settlement).Error; err != nil {
			return fmt.Errorf("failed to save payment: %w", err)
		}
		result = *settlement
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// tickSettlement builds the payment that pays back exactly one share, copying its base amount so the item zeroes out.
func tickSettlement(tx *gorm.DB, group *models.Group, shareID uint) (*models.GroupSettlement, error) {
	var share models.GroupExpenseShare
	if err := tx.First(&share, shareID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareNotTickable
		}
		return nil, fmt.Errorf("failed to load item: %w", err)
	}
	expense, err := loadExpense(tx, group.ID, share.ExpenseID)
	if err != nil {
		if errors.Is(err, ErrExpenseNotFound) {
			return nil, ErrShareNotTickable
		}
		return nil, err
	}
	if expense.Amount == nil || share.Amount == nil || share.BaseAmount == nil || share.MemberID == expense.PaidByMemberID {
		return nil, ErrShareNotTickable
	}
	var ticked int64
	if err := tx.Model(&models.GroupSettlement{}).Where("share_id = ?", share.ID).Count(&ticked).Error; err != nil {
		return nil, fmt.Errorf("failed to check item: %w", err)
	}
	if ticked > 0 {
		return nil, ErrShareAlreadyTicked
	}
	title := expense.Title
	return &models.GroupSettlement{
		FromMemberID: share.MemberID,
		ToMemberID:   expense.PaidByMemberID,
		Amount:       *share.Amount,
		Currency:     expense.Currency,
		ExchangeRate: expense.ExchangeRate,
		BaseAmount:   *share.BaseAmount,
		Date:         utils.NoonUTC(time.Now()),
		Note:         &title,
		ShareID:      &share.ID,
	}, nil
}

func (s *GroupExpenseService) manualSettlement(ctx context.Context, tx *gorm.DB, group *models.Group, req requests.GroupSettlementRequest) (*models.GroupSettlement, error) {
	members, err := activeMembersByID(tx, group.ID)
	if err != nil {
		return nil, err
	}
	if req.FromMemberID == nil || req.ToMemberID == nil || members[*req.FromMemberID] == nil || members[*req.ToMemberID] == nil {
		return nil, validationError("pick who paid and who was paid")
	}
	if *req.FromMemberID == *req.ToMemberID {
		return nil, validationError("pick two different people")
	}
	if req.Amount == nil || utils.ToCents(*req.Amount) <= 0 {
		return nil, validationError("the amount must be above zero")
	}
	currency := group.BaseCurrency
	if req.Currency != nil {
		currency = *req.Currency
	}
	if !types.IsValidCurrencyType(currency) {
		return nil, validationError("unsupported currency")
	}
	date := utils.NoonUTC(time.Now())
	if req.Date != nil && *req.Date != "" {
		if date, err = utils.ParseDay(*req.Date); err != nil {
			return nil, validationError("%s", err.Error())
		}
	}
	rate, _, _, err := s.resolveRate(ctx, group, currency, date, req.ExchangeRate, nil)
	if err != nil {
		return nil, err
	}
	cents := utils.ToCents(*req.Amount)
	return &models.GroupSettlement{
		FromMemberID: *req.FromMemberID,
		ToMemberID:   *req.ToMemberID,
		Amount:       utils.FromCents(cents),
		Currency:     currency,
		ExchangeRate: rate,
		BaseAmount:   utils.FromCents(utils.ConvertCents(cents, rate)),
		Date:         date,
	}, nil
}

func (s *GroupExpenseService) DeleteSettlement(ctx context.Context, groupID, settlementID, userID uint) error {
	return withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if err := requireActive(group); err != nil {
			return err
		}
		result := tx.Where("id = ? AND group_id = ?", settlementID, group.ID).Delete(&models.GroupSettlement{})
		if result.Error != nil {
			return fmt.Errorf("failed to delete payment: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return ErrSettlementNotFound
		}
		return nil
	})
}

// UpdateMe changes the caller's own name in the group and turns syncing their shares into personal records on or off.
func (s *GroupExpenseService) UpdateMe(ctx context.Context, groupID, userID uint, req requests.GroupMeRequest) error {
	return withLockedGroup(ctx, s.db, groupID, userID, func(tx *gorm.DB, group *models.Group, me *models.GroupMember) error {
		if req.DisplayName != nil {
			name, err := cleanName(*req.DisplayName, "your name", maxDisplayNameLength)
			if err != nil {
				return err
			}
			if err := ensureDisplayNameFree(tx, group.ID, name, me.ID); err != nil {
				return err
			}
			if err := tx.Model(me).Update("display_name", name).Error; err != nil {
				return fmt.Errorf("failed to rename: %w", err)
			}
		}
		if req.Sync == nil {
			return nil
		}
		if !req.Sync.Enabled {
			keep := req.Sync.KeepRecords == nil || *req.Sync.KeepRecords
			if err := stopMemberSyncTx(tx, group.ID, userID, keep); err != nil {
				return err
			}
			return tx.Model(me).Update("sync_enabled", false).Error
		}

		categoryID, paymentMethodID := me.SyncCategoryID, me.SyncPaymentMethodID
		if req.Sync.CategoryID != nil {
			categoryID = req.Sync.CategoryID
		}
		if req.Sync.PaymentMethodID != nil {
			paymentMethodID = req.Sync.PaymentMethodID
		}
		if categoryID == nil || paymentMethodID == nil {
			return validationError("pick a category and a payment method for your shares")
		}
		if err := ensureExpenseCategory(tx, userID, *categoryID); err != nil {
			return err
		}
		if err := ensurePaymentMethodOwned(ctx, tx, userID, *paymentMethodID); err != nil {
			return err
		}
		if err := tx.Model(me).Updates(map[string]any{
			"sync_enabled":           true,
			"sync_category_id":       *categoryID,
			"sync_payment_method_id": *paymentMethodID,
		}).Error; err != nil {
			return fmt.Errorf("failed to turn on sync: %w", err)
		}
		me.SyncEnabled = true
		me.SyncCategoryID = categoryID
		me.SyncPaymentMethodID = paymentMethodID
		return backfillMemberRecordsTx(tx, group, me)
	})
}

func ensureExpenseCategory(tx *gorm.DB, userID, categoryID uint) error {
	var count int64
	if err := tx.Model(&models.Category{}).
		Where("id = ? AND user_id = ? AND type = ?", categoryID, userID, types.Expense).
		Count(&count).Error; err != nil {
		return fmt.Errorf("failed to verify category: %w", err)
	}
	if count == 0 {
		return fmt.Errorf("%w: expense category %d", ErrReferenceNotFound, categoryID)
	}
	return nil
}

func readOnlySnapshot() *sql.TxOptions {
	return &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true}
}

type ledgerView struct {
	group     models.Group
	me        *models.GroupMember
	ledger    *groupLedger
	sheet     *balanceSheet
	memberIDs []uint
}

func (s *GroupExpenseService) readLedger(ctx context.Context, groupID, userID uint) (*ledgerView, error) {
	var view ledgerView
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		me, err := findMembership(tx, groupID, userID)
		if err != nil {
			return err
		}
		if err := tx.First(&view.group, groupID).Error; err != nil {
			return fmt.Errorf("failed to load group: %w", err)
		}
		ledger, err := loadGroupLedger(tx, &view.group)
		if err != nil {
			return err
		}
		view.me = me
		view.ledger = ledger
		view.sheet = computeBalances(ledger)
		for _, member := range ledger.Members {
			id := member.ID
			if !member.DeletedAt.Valid || view.sheet.Net[id] != 0 || view.sheet.Paid[id] != 0 || view.sheet.Share[id] != 0 {
				view.memberIDs = append(view.memberIDs, id)
			}
		}
		return nil
	}, readOnlySnapshot())
	if err != nil {
		return nil, err
	}
	return &view, nil
}

func (s *GroupExpenseService) Balances(ctx context.Context, groupID, userID uint) (*dtoResponses.GroupBalancesResponse, error) {
	view, err := s.readLedger(ctx, groupID, userID)
	if err != nil {
		return nil, err
	}
	sheet := view.sheet
	threshold := settleThreshold(view.group.BaseCurrency)
	meID := view.me.ID

	out := &dtoResponses.GroupBalancesResponse{
		Currency:     view.group.BaseCurrency,
		Simplified:   view.group.SimplifyDebts,
		MyMemberID:   meID,
		MyNet:        utils.FromCents(roundToSettled(sheet.Net[meID], threshold)),
		Total:        utils.FromCents(sheet.Total),
		MyShare:      utils.FromCents(sheet.Share[meID]),
		MyPaid:       utils.FromCents(sheet.Paid[meID]),
		PendingCount: sheet.PendingCount,
		ExpenseCount: sheet.ExpenseCount,
		Members:      []dtoResponses.GroupBalanceMemberResponse{},
		Suggested:    []dtoResponses.GroupTransferResponse{},
		WithMe:       []dtoResponses.GroupPairResponse{},
	}
	for _, id := range view.memberIDs {
		out.Members = append(out.Members, dtoResponses.GroupBalanceMemberResponse{
			MemberID: id,
			Paid:     utils.FromCents(sheet.Paid[id]),
			Share:    utils.FromCents(sheet.Share[id]),
			Net:      utils.FromCents(roundToSettled(sheet.Net[id], threshold)),
		})
		if id != meID {
			out.WithMe = append(out.WithMe, dtoResponses.GroupPairResponse{
				MemberID: id,
				Amount:   utils.FromCents(roundToSettled(sheet.Pair(id, meID), threshold)),
			})
		}
	}
	for _, t := range suggestTransfers(sheet, view.memberIDs, view.group.SimplifyDebts, threshold) {
		out.Suggested = append(out.Suggested, dtoResponses.GroupTransferResponse{FromMemberID: t.From, ToMemberID: t.To, Amount: utils.FromCents(t.Cents)})
	}
	return out, nil
}

func (s *GroupExpenseService) Stats(ctx context.Context, groupID, userID uint) (*dtoResponses.GroupStatsResponse, error) {
	view, err := s.readLedger(ctx, groupID, userID)
	if err != nil {
		return nil, err
	}
	sheet := view.sheet
	meID := view.me.ID
	out := &dtoResponses.GroupStatsResponse{
		Currency:     view.group.BaseCurrency,
		Total:        utils.FromCents(sheet.Total),
		MyShare:      utils.FromCents(sheet.Share[meID]),
		MyPaid:       utils.FromCents(sheet.Paid[meID]),
		PendingCount: sheet.PendingCount,
		ExpenseCount: sheet.ExpenseCount,
		Granularity:  "DAY",
		ByCategory:   []dtoResponses.GroupCategoryStatResponse{},
		ByMember:     []dtoResponses.GroupBalanceMemberResponse{},
		ByPeriod:     []dtoResponses.GroupPeriodStatResponse{},
	}

	categoryCents := map[types.GroupExpenseCategory]int64{}
	categoryCount := map[types.GroupExpenseCategory]int{}
	var first, last *time.Time
	for _, item := range view.ledger.Expenses {
		if item.Pending {
			continue
		}
		categoryCents[item.Expense.Category] += item.BaseCents
		categoryCount[item.Expense.Category]++
		day := item.Expense.Date
		if first == nil || day.Before(*first) {
			first = &day
		}
		if last == nil || day.After(*last) {
			last = &day
		}
	}
	for category, cents := range categoryCents {
		out.ByCategory = append(out.ByCategory, dtoResponses.GroupCategoryStatResponse{Category: category, Amount: utils.FromCents(cents), Count: categoryCount[category]})
	}
	sort.Slice(out.ByCategory, func(i, j int) bool {
		if out.ByCategory[i].Amount != out.ByCategory[j].Amount {
			return out.ByCategory[i].Amount > out.ByCategory[j].Amount
		}
		return out.ByCategory[i].Category < out.ByCategory[j].Category
	})
	for _, id := range view.memberIDs {
		out.ByMember = append(out.ByMember, dtoResponses.GroupBalanceMemberResponse{
			MemberID: id,
			Paid:     utils.FromCents(sheet.Paid[id]),
			Share:    utils.FromCents(sheet.Share[id]),
			Net:      utils.FromCents(sheet.Net[id]),
		})
	}

	start, end := view.group.StartDate, view.group.EndDate
	if start == nil {
		start = first
	}
	if end == nil {
		end = last
	}
	if start == nil || end == nil {
		return out, nil
	}
	if first != nil && first.Before(*start) {
		start = first
	}
	if last != nil && last.After(*end) {
		end = last
	}
	from, to := utils.NoonUTC(*start), utils.NoonUTC(*end)
	out.DayCount = int(to.Sub(from).Hours()/24) + 1
	if out.DayCount > 0 {
		out.PerDay = utils.FromCents(sheet.Total / int64(out.DayCount))
	}

	layout := "2006-01-02"
	if out.DayCount > maxDailyStatsSpan {
		out.Granularity = "MONTH"
		layout = "2006-01"
	}
	periodCents := map[string]int64{}
	for _, item := range view.ledger.Expenses {
		if !item.Pending {
			periodCents[item.Expense.Date.UTC().Format(layout)] += item.BaseCents
		}
	}
	seen := map[string]bool{}
	for day := from; !day.After(to); day = day.AddDate(0, 0, 1) {
		key := day.Format(layout)
		if seen[key] {
			continue
		}
		seen[key] = true
		out.ByPeriod = append(out.ByPeriod, dtoResponses.GroupPeriodStatResponse{Period: key, Amount: utils.FromCents(periodCents[key])})
	}
	return out, nil
}
