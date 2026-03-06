package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"html/template"
	"log"
	"os"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"gorm.io/gorm"
)

const (
	PasswordResetTokenDuration = 30 * time.Minute
	PasswordResetTokenBytes    = 32
)

type UserService struct {
	db          *gorm.DB
	mailService *MailService
}

func NewUserService(db *gorm.DB, mailService *MailService) *UserService {
	return &UserService{db: db, mailService: mailService}
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

	shoppingColor := *defaultCategories[5].Color
	transportColor := *defaultCategories[2].Color
	foodColor := *defaultCategories[0].Color

	defaultTrendReports := []models.TrendReport{
		{UserID: user.ID, Color: &shoppingColor, Categories: []models.Category{defaultCategories[5]}},
		{UserID: user.ID, Color: &transportColor, Categories: []models.Category{defaultCategories[2]}},
		{UserID: user.ID, Color: &foodColor, Categories: []models.Category{defaultCategories[0], defaultCategories[7]}},
	}

	for i := range defaultTrendReports {
		if err = tx.Create(&defaultTrendReports[i]).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	if err = tx.Commit().Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *UserService) DeleteUser(ctx context.Context, userID uint) error {
	tx := s.db.WithContext(ctx).Begin()

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var user models.User
	if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
		tx.Rollback()
		return errors.New("user not found")
	}

	anonymized := fmt.Sprintf("[Deleted User #%d]", userID)
	if err := tx.Model(&user).Updates(map[string]any{
		"email": anonymized,
		"name":  anonymized,
	}).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to anonymize user: %w", err)
	}

	if err := tx.Delete(&user).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete user: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit account deletion: %w", err)
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

func (s *UserService) UpdateUser(ctx context.Context, userID uint, req requests.UpdateUserRequest) (*models.User, error) {
	var user models.User
	if err := s.db.WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	if err := s.db.WithContext(ctx).Model(&user).Update("name", req.Name).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *UserService) RequestPasswordReset(ctx context.Context, email string) error {
	user, err := s.GetUserByExample(ctx, models.User{Email: email})
	if err != nil {
		return nil
	}

	plainToken, tokenHash, err := generateResetToken()
	if err != nil {
		return fmt.Errorf("failed to generate reset token: %w", err)
	}

	tx := s.db.WithContext(ctx).Begin()

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Model(&models.PasswordResetToken{}).
		Where("user_id = ? AND used_at IS NULL", user.ID).
		Update("used_at", time.Now()).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to invalidate existing tokens: %w", err)
	}

	resetToken := models.PasswordResetToken{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(PasswordResetTokenDuration),
	}
	if err := tx.Create(&resetToken).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to store reset token: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit password reset token: %w", err)
	}

	var language types.LanguageType
	var setting models.Setting
	if err := s.db.WithContext(ctx).Where("user_id = ?", user.ID).First(&setting).Error; err == nil {
		language = setting.Language
	} else {
		language = types.EnglishLanguage
	}

	go s.sendPasswordResetEmail(user.Email, user.Name, plainToken, language)

	return nil
}

func (s *UserService) ResetPassword(ctx context.Context, token string, newPassword string) (*models.User, error) {
	tokenHash := hashResetToken(token)

	tx := s.db.WithContext(ctx).Begin()

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var resetToken models.PasswordResetToken
	if err := tx.Where("token_hash = ? AND used_at IS NULL AND expires_at > ?", tokenHash, time.Now()).
		First(&resetToken).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("invalid or expired reset token")
	}

	now := time.Now()
	if err := tx.Model(&resetToken).Update("used_at", now).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to mark token as used: %w", err)
	}

	hashedPassword, err := utils.HashPassword(newPassword)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	if err := tx.Model(&models.User{}).
		Where("id = ?", resetToken.UserID).
		Update("password", hashedPassword).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update password: %w", err)
	}

	if err := tx.Model(&models.PasswordResetToken{}).
		Where("user_id = ? AND used_at IS NULL", resetToken.UserID).
		Update("used_at", now).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to invalidate remaining tokens: %w", err)
	}

	var user models.User
	if err := tx.First(&user, resetToken.UserID).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to fetch user: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit password reset: %w", err)
	}

	return &user, nil
}

func generateResetToken() (plain string, hash string, err error) {
	b := make([]byte, PasswordResetTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("failed to generate random token: %w", err)
	}
	plain = base64.RawURLEncoding.EncodeToString(b)
	return plain, hashResetToken(plain), nil
}

func hashResetToken(plainToken string) string {
	h := sha256.Sum256([]byte(plainToken))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

func (s *UserService) sendPasswordResetEmail(email, name, token string, language types.LanguageType) {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", os.Getenv("FRONTEND_URL"), token)

	templatePath := s.mailService.GetEmailTemplatePath(PasswordResetTemplate, language)
	tmpl, err := template.ParseFiles(templatePath)
	if err != nil {
		log.Printf("failed to parse email template: %v", err)
		return
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, map[string]string{
		"UserName": name,
		"ResetURL": resetURL,
	}); err != nil {
		log.Printf("failed to render email template: %v", err)
		return
	}

	subject := s.mailService.GetEmailSubject(PasswordResetTemplate, language)

	if err := s.mailService.SendHTML(email, subject, body.String()); err != nil {
		log.Printf("failed to send reset email to %s: %v", email, err)
	}
}
