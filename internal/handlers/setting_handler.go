package handlers

import (
	"errors"
	"fmt"
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type settingHandler struct {
	settingService *services.SettingService
}

func RegisterSettingHandler(e *echo.Echo, settingService *services.SettingService) {
	handler := &settingHandler{settingService: settingService}

	// Unauthenticated group
	v1 := e.Group("/api/v1/settings")

	// Restricted group
	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())

	r1.GET("", handler.Get)
	r1.PATCH("", handler.Update)
}

func (h *settingHandler) Get(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	setting, err := h.settingService.GetByUserID(c.Request().Context(), claims.UserID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, fmt.Errorf("error reading setting: %w", err))
	}

	return responses.SuccessWithData(c, setting)
}

func (h *settingHandler) Update(c echo.Context) error {
	req := requests.SettingRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	req.UserID = &claims.UserID

	setting, err := h.settingService.Update(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, fmt.Errorf("error updating setting: %w", err))
	}

	return responses.SuccessWithData(c, setting)
}
