package database

import (
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
	})

	if err := m.Migrate(); err != nil {
		log.Fatal("⛔ Exit!!! Cannot apply migrations")
	}
}
