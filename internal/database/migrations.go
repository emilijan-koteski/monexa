package database

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/go-gormigrate/gormigrate/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	seededTestUserEmail        = "test@monexa.com"
	lockedPasswordEntropyBytes = 32
)

func computeContentHash(docType string, version int, title, titleMk, content, contentMk string) string {
	canonical := docType + "\n" + strconv.Itoa(version) + "\n" + title + "\n" + titleMk + "\n" + content + "\n" + contentMk
	hash := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(hash[:])
}

func createUniqueEmailIndex(tx *gorm.DB) error {
	query := `
		CREATE UNIQUE INDEX IF NOT EXISTS unique_email_active_users 
		ON users (email) 
		WHERE deleted_at IS NULL;
	`
	return tx.Exec(query).Error
}

func dropUniqueEmailIndex(tx *gorm.DB) error {
	query := `
		DROP INDEX IF EXISTS unique_email_active_users;
	`
	return tx.Exec(query).Error
}

func autoMigrateWithoutForeignKeys(tx *gorm.DB, dst ...any) error {
	session := tx.Session(&gorm.Session{})
	session.Config.DisableForeignKeyConstraintWhenMigrating = true
	return session.AutoMigrate(dst...)
}

func lockTestUser(tx *gorm.DB) error {
	secret := make([]byte, lockedPasswordEntropyBytes)
	if _, err := rand.Read(secret); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(hex.EncodeToString(secret)), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := tx.Exec("UPDATE users SET password = ? WHERE email = ?", string(hash), seededTestUserEmail).Error; err != nil {
		return err
	}
	return tx.Exec("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ?)", seededTestUserEmail).Error
}

func Migrate(db *gorm.DB) {
	m := gormigrate.New(db, gormigrate.DefaultOptions, []*gormigrate.Migration{
		{
			ID: "20241214094152_create_users_table",
			Migrate: func(tx *gorm.DB) error {
				err := tx.AutoMigrate(&models.User{})
				if err != nil {
					return err
				}
				return createUniqueEmailIndex(tx)
			},
			Rollback: func(tx *gorm.DB) error {
				err := dropUniqueEmailIndex(tx)
				if err != nil {
					return err
				}
				return tx.Migrator().DropTable("users")
			},
		},
		{
			ID: "20241214102308_create_settings_table",
			Migrate: func(tx *gorm.DB) error {
				err := tx.AutoMigrate(&models.Setting{})
				if err != nil {
					return err
				}
				err = db.Exec(`
					alter table public.settings add constraint fk_settings_user foreign key (user_id) references public.users(id);
				`).Error
				if err != nil {
					return err
				}
				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("settings")
			},
		},
		{
			ID: "20241214102915_create_categories_table",
			Migrate: func(tx *gorm.DB) error {
				err := tx.AutoMigrate(&models.Category{})
				if err != nil {
					return err
				}
				err = db.Exec(`
					alter table public.categories add constraint fk_categories_user foreign key (user_id) references public.users(id);
				`).Error
				if err != nil {
					return err
				}
				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("categories")
			},
		},
		{
			ID: "20241214102929_create_payment_methods_table",
			Migrate: func(tx *gorm.DB) error {
				err := tx.AutoMigrate(&models.PaymentMethod{})
				if err != nil {
					return err
				}
				err = db.Exec(`
					alter table public.payment_methods add constraint fk_payment_methods_user foreign key (user_id) references public.users(id);
				`).Error
				if err != nil {
					return err
				}
				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("payment_methods")
			},
		},
		{
			ID: "20241214103104_create_records_table",
			Migrate: func(tx *gorm.DB) error {
				err := tx.AutoMigrate(&models.Record{})
				if err != nil {
					return err
				}
				err = db.Exec(`
					alter table public.records add constraint fk_records_user foreign key (user_id) references public.users(id);
					alter table public.records add constraint fk_records_category foreign key (category_id) references public.categories(id);
					alter table public.records add constraint fk_records_payment_method foreign key (payment_method_id) references public.payment_methods(id);
				`).Error
				if err != nil {
					return err
				}
				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("records")
			},
		},
		{
			ID: "20250302134055_create_sessions_table",
			Migrate: func(tx *gorm.DB) error {
				err := tx.AutoMigrate(&models.Session{})
				if err != nil {
					return err
				}
				err = db.Exec(`
					alter table public.sessions add constraint fk_sessions_user foreign key (user_id) references public.users(id);
				`).Error
				if err != nil {
					return err
				}
				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("sessions")
			},
		},
		{
			ID: "20260125170000_create_exchange_rates_table",
			Migrate: func(tx *gorm.DB) error {
				err := tx.AutoMigrate(&models.ExchangeRate{})
				if err != nil {
					return err
				}
				now := time.Now()

				fallbackRates := []map[string]interface{}{
					{
						"from_currency": "EUR",
						"to_currency":   "MKD",
						"rate":          61.55,
						"source":        "FALLBACK",
						"fetched_at":    now,
						"created_at":    now,
					},
					{
						"from_currency": "MKD",
						"to_currency":   "EUR",
						"rate":          0.016,
						"source":        "FALLBACK",
						"fetched_at":    now,
						"created_at":    now,
					},
					{
						"from_currency": "MKD",
						"to_currency":   "USD",
						"rate":          0.019,
						"source":        "FALLBACK",
						"fetched_at":    now,
						"created_at":    now,
					},
					{
						"from_currency": "USD",
						"to_currency":   "MKD",
						"rate":          52.40,
						"source":        "FALLBACK",
						"fetched_at":    now,
						"created_at":    now,
					},
					{
						"from_currency": "EUR",
						"to_currency":   "USD",
						"rate":          1.17,
						"source":        "FALLBACK",
						"fetched_at":    now,
						"created_at":    now,
					},
					{
						"from_currency": "USD",
						"to_currency":   "EUR",
						"rate":          0.85,
						"source":        "FALLBACK",
						"fetched_at":    now,
						"created_at":    now,
					},
				}

				for _, rate := range fallbackRates {
					if err := tx.Table("exchange_rates").Create(rate).Error; err != nil {
						return err
					}
				}

				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("exchange_rates")
			},
		},
		{
			ID: "20241214104212_add_test_user",
			Migrate: func(tx *gorm.DB) error {
				hashedPassword, err := bcrypt.GenerateFromPassword([]byte("Test@123"), bcrypt.DefaultCost)
				if err != nil {
					return err
				}

				testUser := map[string]interface{}{
					"email":      "test@monexa.com",
					"password":   string(hashedPassword),
					"name":       "Test User",
					"created_at": time.Now(),
				}
				if err := tx.Table("users").Create(testUser).Error; err != nil {
					return err
				}

				var userID uint
				if err := tx.Table("users").Select("id").Where("email = ?", "test@monexa.com").Scan(&userID).Error; err != nil {
					return err
				}

				ppid := utils.GeneratePPID(os.Getenv("PPID_SECRET"), userID)
				if err := tx.Table("users").Where("id = ?", userID).Update("ppid", ppid).Error; err != nil {
					return err
				}

				setting := map[string]interface{}{
					"user_id":  userID,
					"language": "EN",
					"currency": "MKD",
				}
				if err := tx.Table("settings").Create(setting).Error; err != nil {
					return err
				}

				paymentMethods := []map[string]interface{}{
					{
						"user_id": userID,
						"name":    "Cash",
					},
					{
						"user_id": userID,
						"name":    "Card",
					},
				}
				if err := tx.Table("payment_methods").Create(paymentMethods).Error; err != nil {
					return err
				}

				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Exec(`
					DELETE FROM payment_methods WHERE user_id = (SELECT id FROM users WHERE email = 'test@monexa.com');
					DELETE FROM settings WHERE user_id = (SELECT id FROM users WHERE email = 'test@monexa.com');
					DELETE FROM users WHERE email = 'test@monexa.com';
				`).Error
			},
		},
		{
			ID: "20260130225000_add_soft_delete_to_categories_and_payment_methods",
			Migrate: func(tx *gorm.DB) error {
				if !tx.Migrator().HasColumn(&models.Category{}, "DeletedAt") {
					if err := tx.Migrator().AddColumn(&models.Category{}, "DeletedAt"); err != nil {
						return err
					}
				}
				if !tx.Migrator().HasColumn(&models.PaymentMethod{}, "DeletedAt") {
					if err := tx.Migrator().AddColumn(&models.PaymentMethod{}, "DeletedAt"); err != nil {
						return err
					}
				}
				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				if tx.Migrator().HasColumn(&models.Category{}, "DeletedAt") {
					if err := tx.Migrator().DropColumn(&models.Category{}, "DeletedAt"); err != nil {
						return err
					}
				}
				if tx.Migrator().HasColumn(&models.PaymentMethod{}, "DeletedAt") {
					if err := tx.Migrator().DropColumn(&models.PaymentMethod{}, "DeletedAt"); err != nil {
						return err
					}
				}
				return nil
			},
		},
		{
			ID: "20260131145000_add_aud_chf_gbp_exchange_rates",
			Migrate: func(tx *gorm.DB) error {
				now := time.Now()
				fallbackRates := []map[string]interface{}{
					{"from_currency": "MKD", "to_currency": "AUD", "rate": 0.027, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "MKD", "to_currency": "CHF", "rate": 0.015, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "MKD", "to_currency": "GBP", "rate": 0.014, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "EUR", "to_currency": "AUD", "rate": 1.70, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "EUR", "to_currency": "CHF", "rate": 0.92, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "EUR", "to_currency": "GBP", "rate": 0.87, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "USD", "to_currency": "AUD", "rate": 1.44, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "USD", "to_currency": "CHF", "rate": 0.77, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "USD", "to_currency": "GBP", "rate": 0.73, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "AUD", "to_currency": "MKD", "rate": 33.0, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "AUD", "to_currency": "EUR", "rate": 0.58, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "AUD", "to_currency": "USD", "rate": 0.63, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "AUD", "to_currency": "CHF", "rate": 0.56, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "AUD", "to_currency": "GBP", "rate": 0.50, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "CHF", "to_currency": "MKD", "rate": 67.29, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "CHF", "to_currency": "EUR", "rate": 1.09, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "CHF", "to_currency": "USD", "rate": 1.29, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "CHF", "to_currency": "AUD", "rate": 1.86, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "CHF", "to_currency": "GBP", "rate": 0.95, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "GBP", "to_currency": "MKD", "rate": 71.18, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "GBP", "to_currency": "EUR", "rate": 1.15, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "GBP", "to_currency": "USD", "rate": 1.37, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "GBP", "to_currency": "AUD", "rate": 1.97, "source": "FALLBACK", "fetched_at": now, "created_at": now},
					{"from_currency": "GBP", "to_currency": "CHF", "rate": 1.06, "source": "FALLBACK", "fetched_at": now, "created_at": now},
				}

				for _, rate := range fallbackRates {
					if err := tx.Table("exchange_rates").Create(rate).Error; err != nil {
						return err
					}
				}

				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Exec(`DELETE FROM exchange_rates WHERE from_currency IN ('AUD', 'CHF', 'GBP') OR to_currency IN ('AUD', 'CHF', 'GBP')`).Error
			},
		},
		{
			ID: "2026022322200_create_trend_reports",
			Migrate: func(tx *gorm.DB) error {
				if err := tx.AutoMigrate(&models.TrendReport{}); err != nil {
					return err
				}
				if err := tx.Exec(`
					ALTER TABLE public.trend_reports
					ADD CONSTRAINT fk_trend_reports_user
					FOREIGN KEY (user_id) REFERENCES public.users(id);
				`).Error; err != nil {
					return err
				}
				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				if err := tx.Migrator().DropTable("trend_report_categories"); err != nil {
					return err
				}
				return tx.Migrator().DropTable("trend_reports")
			},
		},
		{
			ID: "20260305184000_create_password_reset_tokens_table",
			Migrate: func(tx *gorm.DB) error {
				if err := tx.AutoMigrate(&models.PasswordResetToken{}); err != nil {
					return err
				}
				return tx.Exec(`
					ALTER TABLE public.password_reset_tokens
					ADD CONSTRAINT fk_password_reset_tokens_user
					FOREIGN KEY (user_id) REFERENCES public.users(id);
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("password_reset_tokens")
			},
		},
		{
			ID: "20260306195500_add_soft_delete_to_settings",
			Migrate: func(tx *gorm.DB) error {
				if !tx.Migrator().HasColumn(&models.Setting{}, "DeletedAt") {
					if err := tx.Migrator().AddColumn(&models.Setting{}, "DeletedAt"); err != nil {
						return err
					}
				}
				return tx.Exec("CREATE INDEX IF NOT EXISTS idx_settings_deleted_at ON settings (deleted_at)").Error
			},
			Rollback: func(tx *gorm.DB) error {
				_ = tx.Exec("DROP INDEX IF EXISTS idx_settings_deleted_at").Error
				if tx.Migrator().HasColumn(&models.Setting{}, "DeletedAt") {
					return tx.Migrator().DropColumn(&models.Setting{}, "DeletedAt")
				}
				return nil
			},
		},
		{
			ID: "20260325000000_create_legal_documents_tables",
			Migrate: func(tx *gorm.DB) error {
				if err := tx.AutoMigrate(&models.LegalDocument{}); err != nil {
					return err
				}

				if err := tx.Exec(`
					CREATE UNIQUE INDEX IF NOT EXISTS unique_active_document_per_type
					ON legal_documents (type)
					WHERE is_active = true AND deleted_at IS NULL;
				`).Error; err != nil {
					return err
				}

				if err := tx.AutoMigrate(&models.UserLegalAcceptance{}); err != nil {
					return err
				}

				if err := tx.Exec(`
					ALTER TABLE public.user_legal_acceptances
					ADD CONSTRAINT fk_acceptances_user
					FOREIGN KEY (user_id) REFERENCES public.users(id);

					ALTER TABLE public.user_legal_acceptances
					ADD CONSTRAINT fk_acceptances_document
					FOREIGN KEY (legal_document_id) REFERENCES public.legal_documents(id);

					CREATE UNIQUE INDEX IF NOT EXISTS unique_user_document_acceptance
					ON public.user_legal_acceptances (user_id, legal_document_id)
					WHERE deleted_at IS NULL;
				`).Error; err != nil {
					return err
				}

				now := time.Now()

				ppContent := `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p><h2>Lorem ipsum dolor</h2><p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p><h2>Lorem ipsum</h2><p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p><h2>Lorem ipsum dolor sit amet</h2><p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>`
				ppContentMk := `<p>Лорем ипсум долор сит амет, консектетур адиписцинг елит. Сед до еиусмод темпор инцидидунт ут лаборе ет долоре магна аликуа.</p><h2>Лорем ипсум долор</h2><p>Дуис ауте ируре долор ин репрехендерит ин волуптате велит ессе циллум долоре еу фугиат нулла париатур.</p><h2>Лорем ипсум</h2><p>Сед ут перспициатис унде омнис исте натус еррор сит волуптатем акусантиум доллоремкуе лаудантиум, тотам рем аперијам.</p><h2>Лорем ипсум долор сит амет</h2><p>Немо еним ипсам волуптатем куиа волуптас сит аспернатур аут одит аут фугит, сед куиа консекуунтур магни долорес.</p>`
				tosContent := ppContent
				tosContentMk := ppContentMk

				initialDocuments := []map[string]interface{}{
					{
						"type":               "PRIVACY_POLICY",
						"version":            1,
						"title":              "Privacy Policy",
						"title_mk":           "Политика за приватност",
						"content":            ppContent,
						"content_mk":         ppContentMk,
						"content_hash":       computeContentHash("PRIVACY_POLICY", 1, "Privacy Policy", "Политика за приватност", ppContent, ppContentMk),
						"effective_at":       now,
						"is_active":          false,
						"requires_reconsent": false,
						"created_at":         now,
					},
					{
						"type":               "TERMS_OF_SERVICE",
						"version":            1,
						"title":              "Terms of Service",
						"title_mk":           "Услови за користење",
						"content":            tosContent,
						"content_mk":         tosContentMk,
						"content_hash":       computeContentHash("TERMS_OF_SERVICE", 1, "Terms of Service", "Услови за користење", tosContent, tosContentMk),
						"effective_at":       now,
						"is_active":          false,
						"requires_reconsent": false,
						"created_at":         now,
					},
				}

				for _, doc := range initialDocuments {
					if err := tx.Table("legal_documents").Create(doc).Error; err != nil {
						return err
					}
				}

				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				if err := tx.Migrator().DropTable("user_legal_acceptances"); err != nil {
					return err
				}
				return tx.Migrator().DropTable("legal_documents")
			},
		},
		{
			ID: "20260329000000_add_ppid_to_users",
			Migrate: func(tx *gorm.DB) error {
				if !tx.Migrator().HasColumn(&models.User{}, "PPID") {
					if err := tx.Migrator().AddColumn(&models.User{}, "PPID"); err != nil {
						return err
					}
				}

				var users []struct{ ID uint }
				if err := tx.Table("users").Where("ppid IS NULL OR ppid = ''").Select("id").Find(&users).Error; err != nil {
					return err
				}

				ppidSecret := os.Getenv("PPID_SECRET")
				for _, u := range users {
					ppid := utils.GeneratePPID(ppidSecret, u.ID)
					if err := tx.Table("users").Where("id = ?", u.ID).Update("ppid", ppid).Error; err != nil {
						return err
					}
				}

				return tx.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ppid ON users (ppid) WHERE deleted_at IS NULL").Error
			},
			Rollback: func(tx *gorm.DB) error {
				_ = tx.Exec("DROP INDEX IF EXISTS idx_users_ppid").Error
				if tx.Migrator().HasColumn(&models.User{}, "PPID") {
					return tx.Migrator().DropColumn(&models.User{}, "PPID")
				}
				return nil
			},
		},
		{
			ID: "20260404165500_add_token_family_to_sessions",
			Migrate: func(tx *gorm.DB) error {
				if tx.Migrator().HasColumn(&models.Session{}, "TokenFamily") {
					return nil
				}

				if err := tx.Exec(`ALTER TABLE sessions ADD COLUMN token_family text`).Error; err != nil {
					return err
				}

				if err := tx.Exec(`UPDATE sessions SET token_family = gen_random_uuid()::text WHERE token_family IS NULL OR token_family = ''`).Error; err != nil {
					return err
				}

				if err := tx.Exec(`ALTER TABLE sessions ALTER COLUMN token_family SET NOT NULL`).Error; err != nil {
					return err
				}

				return tx.Exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token_family ON sessions (token_family)`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				_ = tx.Exec("DROP INDEX IF EXISTS idx_sessions_token_family").Error
				if tx.Migrator().HasColumn(&models.Session{}, "TokenFamily") {
					return tx.Migrator().DropColumn(&models.Session{}, "TokenFamily")
				}
				return nil
			},
		},
		{
			ID: "20261006230858_create_recurring_expenses_table",
			Migrate: func(tx *gorm.DB) error {
				if err := tx.AutoMigrate(&models.RecurringExpense{}); err != nil {
					return err
				}
				return tx.Exec(`
					alter table public.recurring_expenses add constraint fk_recurring_expenses_user foreign key (user_id) references public.users(id);
					alter table public.recurring_expenses add constraint fk_recurring_expenses_category foreign key (category_id) references public.categories(id);
					alter table public.recurring_expenses add constraint fk_recurring_expenses_payment_method foreign key (payment_method_id) references public.payment_methods(id);
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("recurring_expenses")
			},
		},
		{
			ID: "20261006230859_add_recurring_expense_id_to_records",
			Migrate: func(tx *gorm.DB) error {
				if !tx.Migrator().HasColumn(&models.Record{}, "RecurringExpenseID") {
					if err := tx.Migrator().AddColumn(&models.Record{}, "RecurringExpenseID"); err != nil {
						return err
					}
				}
				return tx.Exec(`
					alter table public.records add constraint fk_records_recurring_expense foreign key (recurring_expense_id) references public.recurring_expenses(id);
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				_ = tx.Exec("alter table public.records drop constraint if exists fk_records_recurring_expense").Error
				if tx.Migrator().HasColumn(&models.Record{}, "RecurringExpenseID") {
					return tx.Migrator().DropColumn(&models.Record{}, "RecurringExpenseID")
				}
				return nil
			},
		},
		{
			ID: "20261016120000_lock_test_user_in_production",
			Migrate: func(tx *gorm.DB) error {
				if os.Getenv("APP_ENV") != "production" {
					log.Println("ℹ️ Skipped locking the seeded test account: APP_ENV is not production")
					return nil
				}
				if err := lockTestUser(tx); err != nil {
					return err
				}
				log.Println("🔒 Locked the seeded test account (APP_ENV=production)")
				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return nil
			},
		},
		{
			ID: "20261016130000_create_oauth_clients_table",
			Migrate: func(tx *gorm.DB) error {
				return autoMigrateWithoutForeignKeys(tx, &models.OAuthClient{})
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("oauth_clients")
			},
		},
		{
			ID: "20261016130100_create_oauth_grants_table",
			Migrate: func(tx *gorm.DB) error {
				if err := autoMigrateWithoutForeignKeys(tx, &models.OAuthGrant{}); err != nil {
					return err
				}
				return tx.Exec(`
					alter table public.oauth_grants add constraint fk_oauth_grants_user foreign key (user_id) references public.users(id);
					alter table public.oauth_grants add constraint fk_oauth_grants_client foreign key (client_id) references public.oauth_clients(id);
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("oauth_grants")
			},
		},
		{
			ID: "20261016130200_create_oauth_authorizations_table",
			Migrate: func(tx *gorm.DB) error {
				if err := autoMigrateWithoutForeignKeys(tx, &models.OAuthAuthorization{}); err != nil {
					return err
				}
				return tx.Exec(`
					alter table public.oauth_authorizations add constraint fk_oauth_authorizations_client foreign key (client_id) references public.oauth_clients(id) on delete cascade;
					alter table public.oauth_authorizations add constraint fk_oauth_authorizations_user foreign key (user_id) references public.users(id);
					alter table public.oauth_authorizations add constraint fk_oauth_authorizations_grant foreign key (grant_id) references public.oauth_grants(id) on delete cascade;
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("oauth_authorizations")
			},
		},
		{
			ID: "20261016130300_create_oauth_tokens_table",
			Migrate: func(tx *gorm.DB) error {
				if err := autoMigrateWithoutForeignKeys(tx, &models.OAuthToken{}); err != nil {
					return err
				}
				return tx.Exec(`
					alter table public.oauth_tokens add constraint fk_oauth_tokens_grant foreign key (grant_id) references public.oauth_grants(id) on delete cascade;
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("oauth_tokens")
			},
		},
		{
			ID: "20261031120000_add_huf_rsd_exchange_rates",
			Migrate: func(tx *gorm.DB) error {
				now := time.Now()
				perEuro := map[string]float64{
					"MKD": 61.55,
					"EUR": 1,
					"USD": 1.17,
					"AUD": 1.70,
					"CHF": 0.92,
					"GBP": 0.87,
					"HUF": 390.0,
					"RSD": 117.2,
				}
				newCurrencies := map[string]bool{"HUF": true, "RSD": true}
				for from, fromPerEuro := range perEuro {
					for to, toPerEuro := range perEuro {
						if from == to || (!newCurrencies[from] && !newCurrencies[to]) {
							continue
						}
						rate := map[string]interface{}{
							"from_currency": from,
							"to_currency":   to,
							"rate":          toPerEuro / fromPerEuro,
							"source":        "FALLBACK",
							"fetched_at":    now,
							"created_at":    now,
						}
						if err := tx.Table("exchange_rates").Create(rate).Error; err != nil {
							return err
						}
					}
				}
				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Exec(`DELETE FROM exchange_rates WHERE from_currency IN ('HUF', 'RSD') OR to_currency IN ('HUF', 'RSD')`).Error
			},
		},
		{
			ID: "20261031120100_create_groups_table",
			Migrate: func(tx *gorm.DB) error {
				return autoMigrateWithoutForeignKeys(tx, &models.Group{})
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("groups")
			},
		},
		{
			ID: "20261031120200_create_group_members_table",
			Migrate: func(tx *gorm.DB) error {
				if err := autoMigrateWithoutForeignKeys(tx, &models.GroupMember{}); err != nil {
					return err
				}
				return tx.Exec(`
					alter table public.group_members add constraint fk_group_members_group foreign key (group_id) references public.groups(id);
					alter table public.group_members add constraint fk_group_members_user foreign key (user_id) references public.users(id);
					alter table public.group_members add constraint fk_group_members_sync_category foreign key (sync_category_id) references public.categories(id);
					alter table public.group_members add constraint fk_group_members_sync_payment_method foreign key (sync_payment_method_id) references public.payment_methods(id);
					create unique index if not exists uniq_group_members_group_user on public.group_members (group_id, user_id) where user_id is not null and deleted_at is null;
					create unique index if not exists uniq_group_members_group_display_name on public.group_members (group_id, lower(display_name)) where deleted_at is null;
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("group_members")
			},
		},
		{
			ID: "20261031120300_create_group_expenses_table",
			Migrate: func(tx *gorm.DB) error {
				if err := autoMigrateWithoutForeignKeys(tx, &models.GroupExpense{}); err != nil {
					return err
				}
				return tx.Exec(`
					alter table public.group_expenses add constraint fk_group_expenses_group foreign key (group_id) references public.groups(id);
					alter table public.group_expenses add constraint fk_group_expenses_paid_by foreign key (paid_by_member_id) references public.group_members(id);
					alter table public.group_expenses add constraint fk_group_expenses_created_by foreign key (created_by_member_id) references public.group_members(id);
					alter table public.group_expenses add constraint fk_group_expenses_updated_by foreign key (updated_by_member_id) references public.group_members(id);
					create unique index if not exists uniq_group_expenses_client_id on public.group_expenses (group_id, client_id) where client_id is not null;
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("group_expenses")
			},
		},
		{
			ID: "20261031120400_create_group_expense_shares_table",
			Migrate: func(tx *gorm.DB) error {
				if err := autoMigrateWithoutForeignKeys(tx, &models.GroupExpenseShare{}); err != nil {
					return err
				}
				return tx.Exec(`
					alter table public.group_expense_shares add constraint fk_group_expense_shares_expense foreign key (expense_id) references public.group_expenses(id) on delete cascade;
					alter table public.group_expense_shares add constraint fk_group_expense_shares_member foreign key (member_id) references public.group_members(id);
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("group_expense_shares")
			},
		},
		{
			ID: "20261031120500_create_group_settlements_table",
			Migrate: func(tx *gorm.DB) error {
				if err := autoMigrateWithoutForeignKeys(tx, &models.GroupSettlement{}); err != nil {
					return err
				}
				return tx.Exec(`
					alter table public.group_settlements add constraint fk_group_settlements_group foreign key (group_id) references public.groups(id);
					alter table public.group_settlements add constraint fk_group_settlements_from foreign key (from_member_id) references public.group_members(id);
					alter table public.group_settlements add constraint fk_group_settlements_to foreign key (to_member_id) references public.group_members(id);
					alter table public.group_settlements add constraint fk_group_settlements_created_by foreign key (created_by_member_id) references public.group_members(id);
					alter table public.group_settlements add constraint fk_group_settlements_share foreign key (share_id) references public.group_expense_shares(id) on delete set null;
					create unique index if not exists uniq_group_settlements_share on public.group_settlements (share_id) where share_id is not null and deleted_at is null;
					create unique index if not exists uniq_group_settlements_client_id on public.group_settlements (group_id, client_id) where client_id is not null;
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("group_settlements")
			},
		},
		{
			ID: "20261031120600_add_record_group_columns",
			Migrate: func(tx *gorm.DB) error {
				for _, field := range []string{"GroupID", "GroupExpenseShareID", "GroupSyncDetachedAt"} {
					if !tx.Migrator().HasColumn(&models.Record{}, field) {
						if err := tx.Migrator().AddColumn(&models.Record{}, field); err != nil {
							return err
						}
					}
				}
				return tx.Exec(`
					create index if not exists idx_records_group_id on public.records (group_id);
					create unique index if not exists uniq_records_group_expense_share on public.records (group_expense_share_id) where group_expense_share_id is not null and deleted_at is null;
					alter table public.records add constraint fk_records_group foreign key (group_id) references public.groups(id);
					alter table public.records add constraint fk_records_group_expense_share foreign key (group_expense_share_id) references public.group_expense_shares(id) on delete set null;
				`).Error
			},
			Rollback: func(tx *gorm.DB) error {
				if err := tx.Exec(`
					alter table public.records drop constraint if exists fk_records_group_expense_share;
					alter table public.records drop constraint if exists fk_records_group;
					drop index if exists uniq_records_group_expense_share;
					drop index if exists idx_records_group_id;
				`).Error; err != nil {
					return err
				}
				for _, field := range []string{"GroupSyncDetachedAt", "GroupExpenseShareID", "GroupID"} {
					if tx.Migrator().HasColumn(&models.Record{}, field) {
						if err := tx.Migrator().DropColumn(&models.Record{}, field); err != nil {
							return err
						}
					}
				}
				return nil
			},
		},
		{
			ID: "20261101120000_sync_records_in_expense_currency",
			Migrate: func(tx *gorm.DB) error {
				type syncedRecord struct {
					RecordID        uint
					Description     *string
					GroupName       string
					BaseCurrency    string
					Title           string
					ExpenseCurrency string
					ShareAmount     float64
				}
				var rows []syncedRecord
				if err := tx.Raw(`
					select r.id as record_id, r.description, g.name as group_name, g.base_currency,
						e.title, e.currency as expense_currency, s.amount as share_amount
					from records r
					join group_expense_shares s on s.id = r.group_expense_share_id
					join group_expenses e on e.id = s.expense_id
					join groups g on g.id = e.group_id
					where r.deleted_at is null and r.group_sync_detached_at is null
						and e.deleted_at is null and s.amount is not null
				`).Scan(&rows).Error; err != nil {
					return err
				}
				for _, row := range rows {
					amount := utils.FromCents(utils.ToCents(row.ShareAmount))
					updates := map[string]any{"amount": amount, "currency": row.ExpenseCurrency}
					plain := row.GroupName + " · " + row.Title
					if row.ExpenseCurrency != row.BaseCurrency && row.Description != nil {
						legacy := plain + " (" + strconv.FormatFloat(amount, 'f', 2, 64) + " " + row.ExpenseCurrency + ")"
						if *row.Description == legacy {
							updates["description"] = plain
						}
					}
					if err := tx.Model(&models.Record{}).Where("id = ?", row.RecordID).Updates(updates).Error; err != nil {
						return err
					}
				}
				return nil
			},
			Rollback: func(tx *gorm.DB) error {
				return nil
			},
		},
	})

	if err := m.Migrate(); err != nil {
		log.Fatal("⛔ Exit!!! Cannot apply migrations")
	}
}
