package services

import (
	"fmt"

	"github.com/emilijan-koteski/monexa/internal/models"
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
