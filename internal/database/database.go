package database

import (
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ConnectDB initializes and returns a Gorm database instance.
// DATABASE_URL is a libpq/pgx URL, e.g. postgres://user:pass@host:5432/db?sslmode=disable
func ConnectDB() *gorm.DB {
	dsn := os.Getenv("DATABASE_URL")

	logLevel := logger.Info
	if os.Getenv("APP_ENV") == "production" {
		logLevel = logger.Warn
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		log.Fatal("⛔ Exit!!! Failed to connect database")
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("⛔ Exit!!! Failed to configure database")
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	err = sqlDB.Ping()
	if err != nil {
		log.Fatal("⛔ Exit!!! Failed to ping database")
	}

	return db
}
