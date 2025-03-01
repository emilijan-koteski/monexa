package database

import (
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"log"
	"os"
	"time"
)

// ConnectDB initializes and returns a Gorm database instance
func ConnectDB() *gorm.DB {
	dbHost := os.Getenv("DB_HOST")
	dbUser := os.Getenv("DB_USERNAME")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dbPort := os.Getenv("DB_PORT")
	dbSSLMode := os.Getenv("DB_SSLMODE")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s ",
		dbHost, dbUser, dbPassword, dbName, dbPort, dbSSLMode,
	)

	var err error

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
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
