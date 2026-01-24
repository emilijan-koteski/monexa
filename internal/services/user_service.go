package services

import (
	"context"
	"errors"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
)

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

func (s *UserService) GetUserByExample(ctx context.Context, example models.User) (*models.User, error) {
	var user models.User
	if err := s.db.WithContext(ctx).
		Where(&example).
		First(&user).
		Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *UserService) CreateUser(ctx context.Context, req requests.RegisterRequest) (*models.User, error) {
	if req.Email == "" || req.Password == "" || req.Name == "" {
		return nil, errors.New("email, password and name are required")
	}

	tx := s.db.WithContext(ctx).Begin()

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var existingUser models.User
	if err := tx.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		tx.Rollback()
		return nil, errors.New("email already registered")
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	user := models.User{
		Email:    req.Email,
		Password: hashedPassword,
		Name:     req.Name,
	}

	if err = tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	defaultSetting := models.Setting{
		UserID:   user.ID,
		Language: types.EnglishLanguage,
		Currency: types.MacedonianDenar,
	}

	if err = tx.Create(&defaultSetting).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	defaultPaymentMethods := []models.PaymentMethod{
		{UserID: user.ID, Name: "Cash"},
		{UserID: user.ID, Name: "Card"},
	}

	if err = tx.Create(&defaultPaymentMethods).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	defaultCategories := []models.Category{
		{UserID: user.ID, Name: "Food", Type: types.Expense, Description: utils.Ptr("Meals, dining out (restaurants, takeout, fast food, etc.)"), Color: utils.Ptr("#FF5733")},
		{UserID: user.ID, Name: "Groceries", Type: types.Expense, Description: utils.Ptr("Supermarket purchases, fresh produce, household food supplies"), Color: utils.Ptr("#4EFF33")},
		{UserID: user.ID, Name: "Transportation", Type: types.Expense, Description: utils.Ptr("Gas, public transport, ride-sharing, parking fees"), Color: utils.Ptr("#33CFFF")},
		{UserID: user.ID, Name: "Housing", Type: types.Expense, Description: utils.Ptr("Rent, mortgage, property taxes, home maintenance"), Color: utils.Ptr("#FF33A8")},
		{UserID: user.ID, Name: "Medical", Type: types.Expense, Description: utils.Ptr("Doctor visits, medication, insurance co-pays"), Color: utils.Ptr("#FF3333")},
		{UserID: user.ID, Name: "Shopping", Type: types.Expense, Description: utils.Ptr("Clothes, accessories, general retail purchases"), Color: utils.Ptr("#FF9F33")},
		{UserID: user.ID, Name: "Entertainment", Type: types.Expense, Description: utils.Ptr("Movies, concerts, gaming, hobbies, streaming services"), Color: utils.Ptr("#F433FF")},
		{UserID: user.ID, Name: "Drinks", Type: types.Expense, Description: utils.Ptr("Coffee, soft drinks, alcohol, bottled water"), Color: utils.Ptr("#33FFD1")},
		{UserID: user.ID, Name: "Debt & Loans", Type: types.Expense, Description: utils.Ptr("Credit card payments, personal or student loans"), Color: utils.Ptr("#A833FF")},
		{UserID: user.ID, Name: "Gifts & Donations", Type: types.Expense, Description: utils.Ptr("Charity contributions, birthday and wedding gifts"), Color: utils.Ptr("#FFD733")},
		{UserID: user.ID, Name: "Pets", Type: types.Expense, Description: utils.Ptr("Pet food, vet visits, grooming, pet accessories"), Color: utils.Ptr("#33FF57")},
		{UserID: user.ID, Name: "Others", Type: types.Expense, Description: utils.Ptr("Any expenses that don’t fit other categories"), Color: utils.Ptr("#8A8A8A")},
		{UserID: user.ID, Name: "Income", Type: types.Income, Description: utils.Ptr("Salary, freelance, investments, gifts, refunds, and rebates"), Color: utils.Ptr("#33FFB5")},
	}

	if err = tx.Create(&defaultCategories).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *UserService) DeleteUser(ctx context.Context, userID uint) error {
	if err := s.db.WithContext(ctx).Where("id = ?", userID).Delete(&models.User{}).Error; err != nil {
		return err
	}
	return nil
}

func (s *UserService) ChangePassword(ctx context.Context, userID uint, req requests.ChangePasswordRequest) error {
	if req.NewPassword != req.ConfirmPassword {
		return errors.New("passwords do not match")
	}

	var user models.User
	if err := s.db.WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	if err := utils.CheckPassword(req.CurrentPassword, user.Password); err != nil {
		return errors.New("current password is incorrect")
	}

	hashedPassword, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		return err
	}

	if err := s.db.WithContext(ctx).Model(&user).Update("password", hashedPassword).Error; err != nil {
		return err
	}

	return nil
}
