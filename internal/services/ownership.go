package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/emilijan-koteski/monexa/internal/models"
	"gorm.io/gorm"
)

var ErrReferenceNotFound = errors.New("referenced category or payment method not found")

func ensureCategoryOwned(ctx context.Context, db *gorm.DB, userID uint, categoryID uint) error {
	return ensureOwned(ctx, db, &models.Category{}, "category", userID, categoryID)
}

func ensurePaymentMethodOwned(ctx context.Context, db *gorm.DB, userID uint, paymentMethodID uint) error {
	return ensureOwned(ctx, db, &models.PaymentMethod{}, "payment method", userID, paymentMethodID)
}

func ensureOwned(ctx context.Context, db *gorm.DB, model any, label string, userID uint, id uint) error {
	var count int64
	if err := db.WithContext(ctx).
		Model(model).
		Where("id = ? AND user_id = ?", id, userID).
		Count(&count).Error; err != nil {
		return fmt.Errorf("failed to verify %s: %w", label, err)
	}
	if count == 0 {
		return fmt.Errorf("%w: %s %d", ErrReferenceNotFound, label, id)
	}
	return nil
}
