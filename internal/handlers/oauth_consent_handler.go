package handlers

import (
	"errors"
	"log"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	dtoResponses "github.com/emilijan-koteski/monexa/internal/responses"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type oauthConsentHandler struct {
	authorizationService *services.OAuthAuthorizationService
	grantService         *services.OAuthGrantService
}

func RegisterOAuthConsentHandler(
	e *echo.Echo,
	authorizationService *services.OAuthAuthorizationService,
	grantService *services.OAuthGrantService,
	restrictedMiddlewares ...echo.MiddlewareFunc,
) {
	handler := &oauthConsentHandler{
		authorizationService: authorizationService,
		grantService:         grantService,
	}

	v1 := e.Group("/api/v1/oauth")

	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())
	for _, m := range restrictedMiddlewares {
		r1.Use(m)
	}

	r1.GET("/authorizations/:id", handler.GetAuthorization)
	r1.POST("/authorizations/:id/approve", handler.Approve)
	r1.POST("/authorizations/:id/deny", handler.Deny)
	r1.GET("/grants", handler.ListGrants)
	r1.DELETE("/grants/:id", handler.RevokeGrant)
}

func (h *oauthConsentHandler) GetAuthorization(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	authorization, err := h.authorizationService.GetPending(c.Request().Context(), c.Param("id"), claims.UserID)
	if err != nil {
		return authorizationFailure(c, "reading authorization", err)
	}

	return responses.SuccessWithData(c, dtoResponses.NewOAuthAuthorizationResponse(authorization))
}

func (h *oauthConsentHandler) Approve(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	redirectURL, err := h.authorizationService.Approve(c.Request().Context(), c.Param("id"), claims.UserID)
	if err != nil {
		return authorizationFailure(c, "approving authorization", err)
	}

	return responses.SuccessWithData(c, dtoResponses.OAuthRedirectResponse{RedirectURL: redirectURL})
}

func (h *oauthConsentHandler) Deny(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	redirectURL, err := h.authorizationService.Deny(c.Request().Context(), c.Param("id"), claims.UserID)
	if err != nil {
		return authorizationFailure(c, "denying authorization", err)
	}

	return responses.SuccessWithData(c, dtoResponses.OAuthRedirectResponse{RedirectURL: redirectURL})
}

func (h *oauthConsentHandler) ListGrants(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	grants, err := h.grantService.ListOAuthGrants(c.Request().Context(), claims.UserID)
	if err != nil {
		return consentFailure(c, "listing connected apps", err)
	}

	return responses.SuccessWithData(c, dtoResponses.NewOAuthGrantResponses(grants))
}

func (h *oauthConsentHandler) RevokeGrant(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	if err := h.grantService.RevokeOAuthGrant(c.Request().Context(), claims.UserID, id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return consentFailure(c, "revoking connected app", err)
	}

	return responses.Success(c)
}

func authorizationFailure(c echo.Context, operation string, err error) error {
	switch {
	case errors.Is(err, services.ErrOAuthAuthorizationNotFound):
		return responses.NotFound(c)
	case errors.Is(err, services.ErrUserNotFound):
		return responses.Unauthorized(c)
	default:
		return consentFailure(c, operation, err)
	}
}

func consentFailure(c echo.Context, operation string, err error) error {
	log.Printf("oauth consent: %s failed: %v", operation, err)
	return responses.FailureWithMessage(c, "error "+operation)
}
