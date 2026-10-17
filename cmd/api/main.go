package main

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/emilijan-koteski/monexa/internal/clients"
	"github.com/emilijan-koteski/monexa/internal/database"
	"github.com/emilijan-koteski/monexa/internal/jobs"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/routes"
	"github.com/emilijan-koteski/monexa/internal/server"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/token"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Load .env when present (local development). Production injects env vars directly.
	_ = godotenv.Load()
	server.RequireEnv(server.RequiredEnv...)
	log.Println("👍 [1] Environment variables loaded successfully")

	oauthCfg, err := server.LoadOAuthConfig()
	if err != nil {
		log.Fatalf("invalid OAuth configuration: %v", err)
	}
	oauthEnabled := oauthCfg != nil
	log.Printf("👍 [2] OAuth configuration loaded (enabled: %t)", oauthEnabled)

	// Connect database
	db := database.ConnectDB()
	log.Println("👍 [3] Database connected successfully")

	// Apply migrations
	database.Migrate(db)
	log.Println("👍 [4] Migrations applied successfully")

	// Init clients
	exchangeRateClient := clients.NewExchangeRateAPIClient()
	mailClient := clients.NewMailClient()
	cimdClient := clients.NewCIMDClient()
	log.Println("👍 [5] Clients initiated successfully")

	// Feature flags
	legalComplianceEnabled := strings.ToLower(os.Getenv("LEGAL_COMPLIANCE_ENABLED")) != "false"

	// Init services
	healthService := services.NewHealthService(db)
	mailService := services.NewMailService(mailClient)
	legalDocumentService := services.NewLegalDocumentService(db, legalComplianceEnabled)
	userService := services.NewUserService(db, mailService, legalDocumentService)
	tokenMaker := token.NewJWTMaker()
	sessionService := services.NewSessionService(db)
	oauthServiceCfg := server.OAuthConfig{}
	if oauthEnabled {
		oauthServiceCfg = *oauthCfg
	}
	frontendURL := os.Getenv("FRONTEND_URL")
	oauthGrantService := services.NewOAuthGrantService(db)
	oauthClientService := services.NewOAuthClientService(db, cimdClient)
	oauthAuthorizationService := services.NewOAuthAuthorizationService(db, oauthClientService, oauthGrantService,
		oauthServiceCfg.IssuerURL, oauthServiceCfg.ResourceURL, frontendURL)
	oauthTokenService := services.NewOAuthTokenService(db, oauthGrantService, oauthClientService, oauthAuthorizationService,
		legalDocumentService, tokenMaker, oauthServiceCfg.ResourceURL, oauthServiceCfg.MCPClientID, oauthServiceCfg.MCPClientSecret,
		oauthServiceCfg.AccessTokenTTL, oauthServiceCfg.RefreshTokenTTL)
	accessTokenService := services.NewAccessTokenService(db, oauthGrantService, oauthServiceCfg.ResourceURL)
	settingService := services.NewSettingService(db)
	currencyService := services.NewCurrencyService(db, exchangeRateClient)
	categoryService := services.NewCategoryService(db, settingService, currencyService)
	recordService := services.NewRecordService(db, settingService, categoryService, currencyService)
	recurringExpenseService := services.NewRecurringExpenseService(db)
	paymentMethodService := services.NewPaymentMethodService(db)
	exportService := services.NewExportService(db, settingService, legalComplianceEnabled)
	trendReportService := services.NewTrendReportService(db, settingService, currencyService)
	log.Println("👍 [6] All services initiated successfully")

	// Start background jobs
	sessionCleanupJob := jobs.NewSessionCleanupJob(sessionService, 24*time.Hour)
	sessionCleanupJob.Start()
	exchangeRateUpdateJob := jobs.NewExchangeRateUpdateJob(currencyService, 24*time.Hour)
	exchangeRateUpdateJob.Start()
	resetTokenCleanupJob := jobs.NewResetTokenCleanupJob(userService, 24*time.Hour)
	resetTokenCleanupJob.Start()
	accountDeletionJob := jobs.NewAccountDeletionJob(userService, 24*time.Hour)
	accountDeletionJob.Start()
	recurringExpenseGenerationJob := jobs.NewRecurringExpenseGenerationJob(recurringExpenseService, 24*time.Hour)
	recurringExpenseGenerationJob.Start()
	oauthCleanupJob := jobs.NewOAuthCleanupJob(oauthTokenService, oauthAuthorizationService, oauthClientService, 24*time.Hour)
	oauthCleanupJob.Start()
	log.Println("👍 [7] Background jobs started successfully")

	// Init new echo client
	e := echo.New()
	e.IPExtractor = server.ClientIPExtractor()
	log.Println("👍 [8] New Echo HTTP client initiated successfully")

	// Init middlewares
	e.Use(server.RequestLogger())
	e.Use(middleware.Recover())
	e.Use(server.CORSMiddlewares()...)

	var restrictedMiddlewares []echo.MiddlewareFunc
	if legalComplianceEnabled {
		restrictedMiddlewares = append(restrictedMiddlewares, middlewares.LegalComplianceMiddleware(legalDocumentService))
	}
	log.Println("👍 [9] All middlewares initiated successfully")

	// Register handlers and routes
	routes.Register(e, routes.Deps{
		HealthService:             healthService,
		UserService:               userService,
		TokenMaker:                tokenMaker,
		SessionService:            sessionService,
		LegalDocumentService:      legalDocumentService,
		ExportService:             exportService,
		RecordService:             recordService,
		RecurringExpenseService:   recurringExpenseService,
		PaymentMethodService:      paymentMethodService,
		CategoryService:           categoryService,
		SettingService:            settingService,
		TrendReportService:        trendReportService,
		OAuthGrantService:         oauthGrantService,
		OAuthClientService:        oauthClientService,
		OAuthAuthorizationService: oauthAuthorizationService,
		OAuthTokenService:         oauthTokenService,
		AccessTokenService:        accessTokenService,
		OAuthConfig:               oauthCfg,
		FrontendURL:               frontendURL,
		LegalComplianceEnabled:    legalComplianceEnabled,
		RestrictedMiddlewares:     restrictedMiddlewares,
	})
	log.Println("👍 [10] All handlers and routes registered successfully")

	// Start HTTP server
	log.Println("👍 [11] Starting HTTP server...")
	server.StartServer(e)
}
