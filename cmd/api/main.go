package main

import (
	"github.com/emilijan-koteski/monexa/internal/database"
	"github.com/emilijan-koteski/monexa/internal/handlers"
	"github.com/emilijan-koteski/monexa/internal/server"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/token"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
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

	// Init services
	healthService := services.NewHealthService(db)
	userService := services.NewUserService(db)
	tokenMaker := token.NewJWTMaker()
	sessionService := services.NewSessionService(db)
	recordService := services.NewRecordService(db)
	log.Println("👍 [4] All services initiated successfully")

	// Init new echo client
	e := echo.New()
	log.Println("👍 [5] New Echo HTTP client initiated successfully")

	// Init middlewares
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"https://*", "http://*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	log.Println("👍 [6] All middlewares initiated successfully")

	// Register handlers and routes
	handlers.RegisterHealthHandler(e, healthService)
	handlers.RegisterAuthHandler(e, userService, tokenMaker, sessionService)
	handlers.RegisterRecordHandler(e, recordService)
	log.Println("👍 [7] All handlers and routes registered successfully")

	// Start HTTP server
	log.Println("👍 [8] Starting HTTP server...")
	server.StartServer(e)
}
