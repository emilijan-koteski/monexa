package database

import (
	"log"
	"time"

	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/go-gormigrate/gormigrate/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

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

				fallbackRates := []map[string]interface{}{
					{
						"from_currency": "EUR",
						"to_currency":   "MKD",
						"rate":          61.55,
						"source":        "FALLBACK",
						"fetched_at":    time.Now(),
						"created_at":    time.Now(),
					},
					{
						"from_currency": "MKD",
						"to_currency":   "EUR",
						"rate":          0.016,
						"source":        "FALLBACK",
						"fetched_at":    time.Now(),
						"created_at":    time.Now(),
					},
					{
						"from_currency": "MKD",
						"to_currency":   "USD",
						"rate":          0.019,
						"source":        "FALLBACK",
						"fetched_at":    time.Now(),
						"created_at":    time.Now(),
					},
					{
						"from_currency": "USD",
						"to_currency":   "MKD",
						"rate":          52.40,
						"source":        "FALLBACK",
						"fetched_at":    time.Now(),
						"created_at":    time.Now(),
					},
					{
						"from_currency": "EUR",
						"to_currency":   "USD",
						"rate":          1.17,
						"source":        "FALLBACK",
						"fetched_at":    time.Now(),
						"created_at":    time.Now(),
					},
					{
						"from_currency": "USD",
						"to_currency":   "EUR",
						"rate":          0.85,
						"source":        "FALLBACK",
						"fetched_at":    time.Now(),
						"created_at":    time.Now(),
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
				hashedPassword, err := bcrypt.GenerateFromPassword([]byte("test"), bcrypt.DefaultCost)
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
				fallbackRates := []map[string]interface{}{
					{"from_currency": "MKD", "to_currency": "AUD", "rate": 0.027, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "MKD", "to_currency": "CHF", "rate": 0.015, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "MKD", "to_currency": "GBP", "rate": 0.014, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "EUR", "to_currency": "AUD", "rate": 1.70, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "EUR", "to_currency": "CHF", "rate": 0.92, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "EUR", "to_currency": "GBP", "rate": 0.87, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "USD", "to_currency": "AUD", "rate": 1.44, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "USD", "to_currency": "CHF", "rate": 0.77, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "USD", "to_currency": "GBP", "rate": 0.73, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "AUD", "to_currency": "MKD", "rate": 33.0, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "AUD", "to_currency": "EUR", "rate": 0.58, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "AUD", "to_currency": "USD", "rate": 0.63, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "AUD", "to_currency": "CHF", "rate": 0.56, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "AUD", "to_currency": "GBP", "rate": 0.50, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "CHF", "to_currency": "MKD", "rate": 67.29, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "CHF", "to_currency": "EUR", "rate": 1.09, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "CHF", "to_currency": "USD", "rate": 1.29, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "CHF", "to_currency": "AUD", "rate": 1.86, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "CHF", "to_currency": "GBP", "rate": 0.95, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "GBP", "to_currency": "MKD", "rate": 71.18, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "GBP", "to_currency": "EUR", "rate": 1.15, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "GBP", "to_currency": "USD", "rate": 1.37, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "GBP", "to_currency": "AUD", "rate": 1.97, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
					{"from_currency": "GBP", "to_currency": "CHF", "rate": 1.06, "source": "FALLBACK", "fetched_at": time.Now(), "created_at": time.Now()},
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
	})

	if err := m.Migrate(); err != nil {
		log.Fatal("⛔ Exit!!! Cannot apply migrations")
	}
}
