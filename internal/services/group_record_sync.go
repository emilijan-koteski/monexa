package services

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
)

// countGroupRecords counts the user's records still synced from a group and the ones kept after sync was turned off.
func countGroupRecords(tx *gorm.DB, groupID, userID uint) (int64, int64, error) {
	var synced, kept int64
	base := tx.Model(&models.Record{}).Where("group_id = ? AND user_id = ? AND group_expense_share_id IS NOT NULL", groupID, userID)
	if err := base.Session(&gorm.Session{}).Where("group_sync_detached_at IS NULL").Count(&synced).Error; err != nil {
		return 0, 0, fmt.Errorf("failed to count synced records: %w", err)
	}
	if err := base.Session(&gorm.Session{}).Where("group_sync_detached_at IS NOT NULL").Count(&kept).Error; err != nil {
		return 0, 0, fmt.Errorf("failed to count kept records: %w", err)
	}
	return synced, kept, nil
}

// detachGroupRecordsTx turns synced records into plain records, for one user or for everyone in the group when userID is nil.
func detachGroupRecordsTx(tx *gorm.DB, groupID uint, userID *uint) error {
	query := tx.Model(&models.Record{}).Where("group_id = ?", groupID)
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}
	if err := query.Updates(map[string]any{
		"group_id":               nil,
		"group_expense_share_id": nil,
		"group_sync_detached_at": nil,
	}).Error; err != nil {
		return fmt.Errorf("failed to detach synced records: %w", err)
	}
	return nil
}

// removeSyncedRecordsTx deletes the user's records that are still synced from the group, leaving kept ones alone.
func removeSyncedRecordsTx(tx *gorm.DB, groupID, userID uint) error {
	if err := tx.Where("group_id = ? AND user_id = ? AND group_expense_share_id IS NOT NULL AND group_sync_detached_at IS NULL", groupID, userID).
		Delete(&models.Record{}).Error; err != nil {
		return fmt.Errorf("failed to remove synced records: %w", err)
	}
	return nil
}

// syncDescription is the description a synced record gets: "<group> · <title>", plus the original amount when it was paid in another currency.
func syncDescription(group *models.Group, expense *models.GroupExpense, origCents int64) string {
	description := group.Name + " · " + expense.Title
	if expense.Currency != group.BaseCurrency {
		description += fmt.Sprintf(" (%s %s)", strconv.FormatFloat(utils.FromCents(origCents), 'f', 2, 64), expense.Currency)
	}
	return description
}

// memberSyncReady reports whether a member's shares should become records, switching sync off when its category or payment method is gone.
func memberSyncReady(tx *gorm.DB, member *models.GroupMember) (bool, error) {
	if member == nil || !member.SyncEnabled || member.UserID == nil || member.SyncCategoryID == nil || member.SyncPaymentMethodID == nil {
		return false, nil
	}
	var categories, paymentMethods int64
	if err := tx.Model(&models.Category{}).
		Where("id = ? AND user_id = ? AND type = ?", *member.SyncCategoryID, *member.UserID, types.Expense).
		Count(&categories).Error; err != nil {
		return false, fmt.Errorf("failed to check sync category: %w", err)
	}
	if err := tx.Model(&models.PaymentMethod{}).
		Where("id = ? AND user_id = ?", *member.SyncPaymentMethodID, *member.UserID).
		Count(&paymentMethods).Error; err != nil {
		return false, fmt.Errorf("failed to check sync payment method: %w", err)
	}
	if categories == 0 || paymentMethods == 0 {
		if err := tx.Model(member).Update("sync_enabled", false).Error; err != nil {
			return false, fmt.Errorf("failed to turn off sync: %w", err)
		}
		member.SyncEnabled = false
		return false, nil
	}
	return true, nil
}

func shareCents(value *float64) int64 {
	if value == nil {
		return 0
	}
	return utils.ToCents(*value)
}

// upsertShareRecordTx creates or refreshes the member's record for one share; user-edited descriptions are kept.
func upsertShareRecordTx(tx *gorm.DB, group *models.Group, member *models.GroupMember, expense *models.GroupExpense, share *models.GroupExpenseShare, previousDescription string) error {
	description := syncDescription(group, expense, shareCents(share.Amount))
	amount := utils.FromCents(shareCents(share.BaseAmount))

	var existing models.Record
	err := tx.Where("group_expense_share_id = ?", share.ID).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("failed to load synced record: %w", err)
	}
	if err == nil && existing.UserID != *member.UserID {
		if err := detachRecordTx(tx, existing.ID); err != nil {
			return err
		}
		err = gorm.ErrRecordNotFound
	}

	if err == nil {
		if existing.GroupSyncDetachedAt != nil {
			return nil
		}
		updates := map[string]any{
			"amount":   amount,
			"currency": group.BaseCurrency,
			"date":     expense.Date,
			"group_id": group.ID,
		}
		if existing.Description == nil || *existing.Description == previousDescription || *existing.Description == description {
			updates["description"] = description
		}
		if err := tx.Model(&models.Record{}).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
			return fmt.Errorf("failed to update synced record: %w", err)
		}
		return nil
	}

	record := models.Record{
		UserID:              *member.UserID,
		CategoryID:          *member.SyncCategoryID,
		PaymentMethodID:     *member.SyncPaymentMethodID,
		Amount:              amount,
		Currency:            group.BaseCurrency,
		Description:         &description,
		Date:                expense.Date,
		GroupID:             &group.ID,
		GroupExpenseShareID: &share.ID,
	}
	if err := tx.Create(&record).Error; err != nil {
		return fmt.Errorf("failed to create synced record: %w", err)
	}
	return nil
}

func detachRecordTx(tx *gorm.DB, recordID uint) error {
	if err := tx.Model(&models.Record{}).Where("id = ?", recordID).Updates(map[string]any{
		"group_id":               nil,
		"group_expense_share_id": nil,
		"group_sync_detached_at": nil,
	}).Error; err != nil {
		return fmt.Errorf("failed to detach record: %w", err)
	}
	return nil
}

func removeManagedShareRecordTx(tx *gorm.DB, shareID uint) error {
	if err := tx.Where("group_expense_share_id = ? AND group_sync_detached_at IS NULL", shareID).Delete(&models.Record{}).Error; err != nil {
		return fmt.Errorf("failed to remove synced record: %w", err)
	}
	return nil
}

// dropShareRecordsTx is used when shares go away: synced records are deleted and kept ones become plain records.
func dropShareRecordsTx(tx *gorm.DB, shareIDs []uint) error {
	if len(shareIDs) == 0 {
		return nil
	}
	if err := tx.Where("group_expense_share_id IN ? AND group_sync_detached_at IS NULL", shareIDs).Delete(&models.Record{}).Error; err != nil {
		return fmt.Errorf("failed to remove synced records: %w", err)
	}
	if err := tx.Model(&models.Record{}).Where("group_expense_share_id IN ?", shareIDs).Updates(map[string]any{
		"group_id":               nil,
		"group_expense_share_id": nil,
		"group_sync_detached_at": nil,
	}).Error; err != nil {
		return fmt.Errorf("failed to detach kept records: %w", err)
	}
	return nil
}

// syncExpenseRecordsTx brings every synced member's record in line with the expense; previous holds the descriptions generated before an edit.
func syncExpenseRecordsTx(tx *gorm.DB, group *models.Group, expense *models.GroupExpense, shares []models.GroupExpenseShare, members map[uint]*models.GroupMember, previous map[uint]string) error {
	pending := expense.Amount == nil
	for i := range shares {
		share := &shares[i]
		member := members[share.MemberID]
		ready, err := memberSyncReady(tx, member)
		if err != nil {
			return err
		}
		if !ready || pending || shareCents(share.BaseAmount) <= 0 {
			if err := removeManagedShareRecordTx(tx, share.ID); err != nil {
				return err
			}
			continue
		}
		if err := upsertShareRecordTx(tx, group, member, expense, share, previous[share.MemberID]); err != nil {
			return err
		}
	}
	return nil
}

// backfillMemberRecordsTx re-links records the member kept earlier and creates records for every share they have.
func backfillMemberRecordsTx(tx *gorm.DB, group *models.Group, member *models.GroupMember) error {
	if err := tx.Model(&models.Record{}).
		Where("group_id = ? AND user_id = ? AND group_expense_share_id IS NOT NULL AND group_sync_detached_at IS NOT NULL", group.ID, *member.UserID).
		Update("group_sync_detached_at", nil).Error; err != nil {
		return fmt.Errorf("failed to re-link kept records: %w", err)
	}
	var expenses []models.GroupExpense
	if err := tx.Preload("Shares", "member_id = ?", member.ID).Where("group_id = ?", group.ID).Find(&expenses).Error; err != nil {
		return fmt.Errorf("failed to load expenses: %w", err)
	}
	members := map[uint]*models.GroupMember{member.ID: member}
	for i := range expenses {
		if err := syncExpenseRecordsTx(tx, group, &expenses[i], expenses[i].Shares, members, nil); err != nil {
			return err
		}
	}
	return nil
}

// stopMemberSyncTx turns a member's synced records into kept records, or deletes them when keep is false.
func stopMemberSyncTx(tx *gorm.DB, groupID, userID uint, keep bool) error {
	managed := tx.Where("group_id = ? AND user_id = ? AND group_expense_share_id IS NOT NULL AND group_sync_detached_at IS NULL", groupID, userID)
	if !keep {
		if err := managed.Delete(&models.Record{}).Error; err != nil {
			return fmt.Errorf("failed to remove synced records: %w", err)
		}
		return nil
	}
	if err := managed.Model(&models.Record{}).Update("group_sync_detached_at", time.Now()).Error; err != nil {
		return fmt.Errorf("failed to keep synced records: %w", err)
	}
	return nil
}
