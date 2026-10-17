package routes

import (
	"github.com/emilijan-koteski/monexa/internal/handlers"
	"github.com/emilijan-koteski/monexa/internal/server"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/token"
	"github.com/labstack/echo/v4"
)

type Deps struct {
	HealthService             *services.HealthService
	UserService               *services.UserService
	TokenMaker                *token.JWTMaker
	SessionService            *services.SessionService
	LegalDocumentService      *services.LegalDocumentService
	ExportService             *services.ExportService
	RecordService             *services.RecordService
	RecurringExpenseService   *services.RecurringExpenseService
	PaymentMethodService      *services.PaymentMethodService
	CategoryService           *services.CategoryService
	SettingService            *services.SettingService
	TrendReportService        *services.TrendReportService
	OAuthGrantService         *services.OAuthGrantService
	OAuthClientService        *services.OAuthClientService
	OAuthAuthorizationService *services.OAuthAuthorizationService
	OAuthTokenService         *services.OAuthTokenService
	AccessTokenService        *services.AccessTokenService
	OAuthConfig               *server.OAuthConfig
	FrontendURL               string
	LegalComplianceEnabled    bool
	RestrictedMiddlewares     []echo.MiddlewareFunc
}

// Register mounts every HTTP handler on e. The legal document routes need LegalComplianceEnabled
// and the OAuth, consent and access token routes need a non-nil OAuthConfig.
func Register(e *echo.Echo, deps Deps) {
	handlers.RegisterHealthHandler(e, deps.HealthService)
	handlers.RegisterAuthHandler(e, deps.UserService, deps.TokenMaker, deps.SessionService, deps.LegalDocumentService, deps.OAuthGrantService)
	handlers.RegisterUserHandler(e, deps.UserService, deps.ExportService, deps.RestrictedMiddlewares...)
	handlers.RegisterRecordHandler(e, deps.RecordService, deps.RestrictedMiddlewares...)
	handlers.RegisterRecurringExpenseHandler(e, deps.RecurringExpenseService, deps.RestrictedMiddlewares...)
	handlers.RegisterPaymentMethodHandler(e, deps.PaymentMethodService, deps.RestrictedMiddlewares...)
	handlers.RegisterCategoryHandler(e, deps.CategoryService, deps.RestrictedMiddlewares...)
	handlers.RegisterSettingHandler(e, deps.SettingService, deps.RestrictedMiddlewares...)
	handlers.RegisterTrendReportHandler(e, deps.TrendReportService, deps.RestrictedMiddlewares...)
	if deps.LegalComplianceEnabled {
		handlers.RegisterLegalDocumentHandler(e, deps.LegalDocumentService)
	}
	if deps.OAuthConfig != nil {
		handlers.RegisterOAuthHandler(e, deps.OAuthConfig, deps.FrontendURL, deps.OAuthClientService, deps.OAuthAuthorizationService, deps.OAuthTokenService)
		handlers.RegisterOAuthConsentHandler(e, deps.OAuthAuthorizationService, deps.OAuthGrantService, deps.RestrictedMiddlewares...)
		handlers.RegisterAccessTokenHandler(e, deps.AccessTokenService, deps.RestrictedMiddlewares...)
	}
}
