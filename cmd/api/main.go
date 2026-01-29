package main

import (
	"log"
	"os"
	"time"

	"github.com/emilijan-koteski/monexa/internal/clients"
	"github.com/emilijan-koteski/monexa/internal/database"
	"github.com/emilijan-koteski/monexa/internal/handlers"
	"github.com/emilijan-koteski/monexa/internal/jobs"
	"github.com/emilijan-koteski/monexa/internal/server"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/token"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		if os.Getenv("APP_ENV") == "" {
			log.Fatal("⛔ Exit!!! Error loading .env file")
		}
	}
	log.Println("👍 [1] Environment variables loaded successfully")

	// Connect database
	db := database.ConnectDB()
	log.Println("👍 [2] Database connected successfully")

	// Apply migrations
	database.Migrate(db)
	log.Println("👍 [3] Migrations applied successfully")

	// Init clients
	exchangeRateClient := clients.NewExchangeRateAPIClient()
	log.Println("👍 [4] Clients initiated successfully")

	// Init services
	healthService := services.NewHealthService(db)
	userService := services.NewUserService(db)
	tokenMaker := token.NewJWTMaker()
	sessionService := services.NewSessionService(db)
	settingService := services.NewSettingService(db)
	currencyService := services.NewCurrencyService(db, exchangeRateClient)
	categoryService := services.NewCategoryService(db, settingService, currencyService)
	recordService := services.NewRecordService(db, settingService, categoryService, currencyService)
	paymentMethodService := services.NewPaymentMethodService(db)
	log.Println("👍 [5] All services initiated successfully")

	// Start background jobs
	sessionCleanupJob := jobs.NewSessionCleanupJob(sessionService, 24*time.Hour)
	sessionCleanupJob.Start()
	exchangeRateUpdateJob := jobs.NewExchangeRateUpdateJob(currencyService, 24*time.Hour)
	exchangeRateUpdateJob.Start()
	log.Println("👍 [6] Background jobs started successfully")

	// Init new echo client
	e := echo.New()
	log.Println("👍 [7] New Echo HTTP client initiated successfully")

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
	log.Println("👍 [8] All middlewares initiated successfully")

	// Register handlers and routes
	handlers.RegisterHealthHandler(e, healthService)
	handlers.RegisterAuthHandler(e, userService, tokenMaker, sessionService)
	handlers.RegisterUserHandler(e, userService)
	handlers.RegisterRecordHandler(e, recordService)
	handlers.RegisterPaymentMethodHandler(e, paymentMethodService)
	handlers.RegisterCategoryHandler(e, categoryService)
	handlers.RegisterSettingHandler(e, settingService)
	log.Println("👍 [9] All handlers and routes registered successfully")

	// Start HTTP server
	log.Println("👍 [10] Starting HTTP server...")
	server.StartServer(e)
}
