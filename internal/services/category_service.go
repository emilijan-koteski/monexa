package services

import (
	"context"
	"errors"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"gorm.io/gorm"
)

type CategoryService struct {
	db *gorm.DB
}

func NewCategoryService(db *gorm.DB) *CategoryService {
	return &CategoryService{db: db}
}

func (s *CategoryService) GetByExample(ctx context.Context, example models.Category) (*models.Category, error) {
	var category models.Category
	if err := s.db.WithContext(ctx).
		Where(&example).
		First(&category).
		Error; err != nil {
		return nil, err
	}

	return &category, nil
}

func (s *CategoryService) Create(ctx context.Context, req requests.CategoryRequest) (*models.Category, error) {
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}
	if req.Name == nil || *req.Name == "" {
		return nil, errors.New("invalid name")
	}
	if req.Type == nil || !types.IsValidCategoryType(*req.Type) {
		return nil, errors.New("invalid type")
	}

	category := models.Category{
		UserID: *req.UserID,
		Name:   *req.Name,
		Type:   *req.Type,
	}

	if req.Description != nil && *req.Description != "" {
		category.Description = req.Description
	}

	if req.Color != nil && *req.Color != "" {
		category.Color = req.Color
	}

	if err := s.db.WithContext(ctx).Create(&category).Error; err != nil {
		return nil, err
	}

	return &category, nil
}

func (s *CategoryService) Update(ctx context.Context, req requests.CategoryRequest) (*models.Category, error) {
	if req.ID == nil || *req.ID == 0 {
		return nil, errors.New("invalid category id")
	}
	if req.UserID == nil || *req.UserID == 0 {
		return nil, errors.New("invalid user id")
	}

	category, err := s.GetByExample(ctx, models.Category{ID: *req.ID})
	if err != nil {
		return nil, err
	}

	if req.Name != nil && *req.Name != "" {
		category.Name = *req.Name
	}
	if req.Type != nil && types.IsValidCategoryType(*req.Type) {
		category.Type = *req.Type
	}
	if req.Description != nil {
		category.Description = req.Description
	}
	if req.Color != nil {
		category.Color = req.Color
	}

	if err = s.db.WithContext(ctx).Save(&category).Error; err != nil {
		return nil, err
	}

	return category, nil
}

func (s *CategoryService) Delete(ctx context.Context, categoryID uint) error {
	if err := s.db.WithContext(ctx).Where("id = ?", categoryID).Delete(&models.Category{}).Error; err != nil {
		return err
	}
	return nil
}

func (s *CategoryService) IsOwner(ctx context.Context, userID uint, categoryID uint) (bool, error) {
	var category models.Category
	err := s.db.WithContext(ctx).
		Select("user_id").
		Where("id = ?", categoryID).
		First(&category).Error

	if err != nil {
		return false, err
	}

	return category.UserID == userID, nil
}
