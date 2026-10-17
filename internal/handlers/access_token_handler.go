package handlers

import (
	"errors"
	"log"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type accessTokenHandler struct {
	accessTokenService *services.AccessTokenService
}

func RegisterAccessTokenHandler(e *echo.Echo, accessTokenService *services.AccessTokenService, restrictedMiddlewares ...echo.MiddlewareFunc) {
	handler := &accessTokenHandler{accessTokenService: accessTokenService}

	v1 := e.Group("/api/v1/access-tokens")

	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())
	for _, m := range restrictedMiddlewares {
		r1.Use(m)
	}

	r1.GET("", handler.List)
	r1.POST("", handler.Create)
	r1.DELETE("/:id", handler.Revoke)
}

func (h *accessTokenHandler) List(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	tokens, err := h.accessTokenService.List(c.Request().Context(), claims.UserID)
	if err != nil {
		return accessTokenFailure(c, "listing access tokens", err)
	}

	return responses.SuccessWithData(c, tokens)
}

func (h *accessTokenHandler) Create(c echo.Context) error {
	req := requests.AccessTokenRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	created, err := h.accessTokenService.Create(c.Request().Context(), claims.UserID, req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrAccessTokenInvalid):
			return responses.BadRequestWithError(c, err)
		case errors.Is(err, services.ErrAccessTokenLimitReached):
			return responses.ConflictWithMessage(c, "access token limit reached (10)")
		case errors.Is(err, services.ErrUserNotFound):
			return responses.Unauthorized(c)
		default:
			return accessTokenFailure(c, "creating access token", err)
		}
	}

	return responses.CreatedWithData(c, created)
}

func (h *accessTokenHandler) Revoke(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	if err := h.accessTokenService.Revoke(c.Request().Context(), claims.UserID, id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return accessTokenFailure(c, "revoking access token", err)
	}

	return responses.Success(c)
}

func accessTokenFailure(c echo.Context, operation string, err error) error {
	log.Printf("access tokens: %s failed: %v", operation, err)
	return responses.FailureWithMessage(c, "error "+operation)
}
