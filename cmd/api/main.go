package main

import (
	"github.com/emilijan-koteski/monexa/internal/database"
	"github.com/emilijan-koteski/monexa/internal/server"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"log"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Fatal("⛔ Exit!!! Error loading .env file")
	}
	log.Println("👍 [1] Environment variables loaded successfully")

	// Connect database (rename the response below to 'db' for usage)
	db := database.ConnectDB()
	log.Println("👍 [2] Database connected successfully")

	// Apply migrations
	database.Migrate(db)
	log.Println("👍 [3] Migrations applied successfully")

	// Init new echo client
	e := echo.New()
	log.Println("👍 [3] New Echo HTTP client initiated successfully")

	// Start HTTP server
	log.Println("👍 [4] Starting HTTP server...")
	server.StartServer(e)
}
