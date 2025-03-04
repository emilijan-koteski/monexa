package handlers

import (
	"fmt"
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/labstack/echo/v4"
)

type recordHandler struct {
	recordService *services.RecordService
}

func RegisterRecordHandler(e *echo.Echo, recordService *services.RecordService) {
	handler := &recordHandler{recordService: recordService}

	// Unauthenticated group
	v1 := e.Group("/api/v1/records")

	// Restricted group
	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())

	r1.POST("", handler.Create)
}

func (h *recordHandler) Create(c echo.Context) error {
	req := requests.RecordRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	req.UserID = &claims.UserID

	record, err := h.recordService.Create(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error creating record: %w", err))
	}

	return responses.SuccessWithData(c, record)
}
