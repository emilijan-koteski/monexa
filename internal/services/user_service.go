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

	language := types.EnglishLanguage
	if req.Language != nil && types.LanguageType(*req.Language) == types.MacedonianLanguage {
		language = types.MacedonianLanguage
	}

	defaultSetting := models.Setting{
		UserID:   user.ID,
		Language: language,
		Currency: types.MacedonianDenar,
	}

	if err = tx.Create(&defaultSetting).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	defaultPaymentMethods := getDefaultPaymentMethods(user.ID, language)

	if err = tx.Create(&defaultPaymentMethods).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	defaultCategories := getDefaultCategories(user.ID, language)

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

func (s *UserService) CleanupExpiredResetTokens(ctx context.Context) (int64, error) {
	result := s.db.WithContext(ctx).
		Where("expires_at < ? OR used_at IS NOT NULL", time.Now()).
		Delete(&models.PasswordResetToken{})

	if result.Error != nil {
		return 0, result.Error
	}

	return result.RowsAffected, nil
}

func getDefaultPaymentMethods(userID uint, language types.LanguageType) []models.PaymentMethod {
	if language == types.MacedonianLanguage {
		return []models.PaymentMethod{
			{UserID: userID, Name: "Кеш"},
			{UserID: userID, Name: "Картичка"},
		}
	}
	return []models.PaymentMethod{
		{UserID: userID, Name: "Cash"},
		{UserID: userID, Name: "Card"},
	}
}

func getDefaultCategories(userID uint, language types.LanguageType) []models.Category {
	if language == types.MacedonianLanguage {
		return []models.Category{
			{UserID: userID, Name: "Храна", Type: types.Expense, Description: utils.Ptr("Оброци, јадење надвор (ресторани, брза храна итн.)"), Color: utils.Ptr("#FF5733")},
			{UserID: userID, Name: "Намирници", Type: types.Expense, Description: utils.Ptr("Купување во маркет, свежи производи, домашни потреби"), Color: utils.Ptr("#4EFF33")},
			{UserID: userID, Name: "Транспорт", Type: types.Expense, Description: utils.Ptr("Гориво, јавен превоз, такси, паркирање"), Color: utils.Ptr("#33CFFF")},
			{UserID: userID, Name: "Домување", Type: types.Expense, Description: utils.Ptr("Кирија, хипотека, данок на имот, одржување на дом"), Color: utils.Ptr("#FF33A8")},
			{UserID: userID, Name: "Медицина", Type: types.Expense, Description: utils.Ptr("Доктор, лекарства, осигурување"), Color: utils.Ptr("#FF3333")},
			{UserID: userID, Name: "Шопинг", Type: types.Expense, Description: utils.Ptr("Облека, додатоци, општо купување"), Color: utils.Ptr("#FF9F33")},
			{UserID: userID, Name: "Забава", Type: types.Expense, Description: utils.Ptr("Филмови, концерти, игри, хобија, стриминг сервиси"), Color: utils.Ptr("#F433FF")},
			{UserID: userID, Name: "Пијалаци", Type: types.Expense, Description: utils.Ptr("Кафе, безалкохолни пијалаци, алкохол, вода"), Color: utils.Ptr("#33FFD1")},
			{UserID: userID, Name: "Долгови и заеми", Type: types.Expense, Description: utils.Ptr("Кредитни картички, лични или студентски заеми"), Color: utils.Ptr("#A833FF")},
			{UserID: userID, Name: "Подароци и донации", Type: types.Expense, Description: utils.Ptr("Хуманитарни прилози, подароци за роденден и свадба"), Color: utils.Ptr("#FFD733")},
			{UserID: userID, Name: "Домашни миленици", Type: types.Expense, Description: utils.Ptr("Храна за миленици, ветеринар, нега, додатоци"), Color: utils.Ptr("#33FF57")},
			{UserID: userID, Name: "Останато", Type: types.Expense, Description: utils.Ptr("Трошоци кои не спаѓаат во други категории"), Color: utils.Ptr("#8A8A8A")},
			{UserID: userID, Name: "Приход", Type: types.Income, Description: utils.Ptr("Плата, инвестиции, подароци, поврат на средства"), Color: utils.Ptr("#33FFB5")},
		}
	}
	return []models.Category{
		{UserID: userID, Name: "Food", Type: types.Expense, Description: utils.Ptr("Meals, dining out (restaurants, takeout, fast food, etc.)"), Color: utils.Ptr("#FF5733")},
		{UserID: userID, Name: "Groceries", Type: types.Expense, Description: utils.Ptr("Supermarket purchases, fresh produce, household food supplies"), Color: utils.Ptr("#4EFF33")},
		{UserID: userID, Name: "Transportation", Type: types.Expense, Description: utils.Ptr("Gas, public transport, ride-sharing, parking fees"), Color: utils.Ptr("#33CFFF")},
		{UserID: userID, Name: "Housing", Type: types.Expense, Description: utils.Ptr("Rent, mortgage, property taxes, home maintenance"), Color: utils.Ptr("#FF33A8")},
		{UserID: userID, Name: "Medical", Type: types.Expense, Description: utils.Ptr("Doctor visits, medication, insurance co-pays"), Color: utils.Ptr("#FF3333")},
		{UserID: userID, Name: "Shopping", Type: types.Expense, Description: utils.Ptr("Clothes, accessories, general retail purchases"), Color: utils.Ptr("#FF9F33")},
		{UserID: userID, Name: "Entertainment", Type: types.Expense, Description: utils.Ptr("Movies, concerts, gaming, hobbies, streaming services"), Color: utils.Ptr("#F433FF")},
		{UserID: userID, Name: "Drinks", Type: types.Expense, Description: utils.Ptr("Coffee, soft drinks, alcohol, bottled water"), Color: utils.Ptr("#33FFD1")},
		{UserID: userID, Name: "Debt & Loans", Type: types.Expense, Description: utils.Ptr("Credit card payments, personal or student loans"), Color: utils.Ptr("#A833FF")},
		{UserID: userID, Name: "Gifts & Donations", Type: types.Expense, Description: utils.Ptr("Charity contributions, birthday and wedding gifts"), Color: utils.Ptr("#FFD733")},
		{UserID: userID, Name: "Pets", Type: types.Expense, Description: utils.Ptr("Pet food, vet visits, grooming, pet accessories"), Color: utils.Ptr("#33FF57")},
		{UserID: userID, Name: "Others", Type: types.Expense, Description: utils.Ptr("Any expenses that don't fit other categories"), Color: utils.Ptr("#8A8A8A")},
		{UserID: userID, Name: "Income", Type: types.Income, Description: utils.Ptr("Salary, freelance, investments, gifts, refunds, and rebates"), Color: utils.Ptr("#33FFB5")},
	}
}

func (s *UserService) sendPasswordResetEmail(email, name, token string, language types.LanguageType) {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s&lang=%s", os.Getenv("FRONTEND_URL"), token, string(language))

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
