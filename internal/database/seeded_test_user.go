package database

import (
	"fmt"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	seededTestUserPassword = "Test@123"
	productionAppEnv       = "production"
)

// EnsureSeededTestUserLocked re-locks the seeded test account in production while its seeded password still works.
// It runs at every start, so a lock that the one-time migration skipped cannot leave the account open.
func EnsureSeededTestUserLocked(db *gorm.DB) error {
	if os.Getenv("APP_ENV") != productionAppEnv {
		return nil
	}
	usable, err := seededTestUserPasswordWorks(db)
	if err != nil || !usable {
		return err
	}
	if err := db.Transaction(lockTestUser); err != nil {
		return fmt.Errorf("failed to lock the seeded test account: %w", err)
	}
	log.Println("🔒 Re-locked the seeded test account because its seeded password still worked (APP_ENV=production)")
	return nil
}

func seededTestUserPasswordWorks(db *gorm.DB) (bool, error) {
	var hashes []string
	if err := db.Raw("SELECT password FROM users WHERE email = ?", seededTestUserEmail).Scan(&hashes).Error; err != nil {
		return false, fmt.Errorf("failed to read the seeded test account: %w", err)
	}
	for _, hash := range hashes {
		if bcrypt.CompareHashAndPassword([]byte(hash), []byte(seededTestUserPassword)) == nil {
			return true, nil
		}
	}
	return false, nil
}
