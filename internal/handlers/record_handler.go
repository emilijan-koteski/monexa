package handlers

import (
	"errors"
	"fmt"
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
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

	r1.GET("/:id", handler.Read)
	r1.POST("", handler.Create)
	r1.PATCH("/:id", handler.Update)
	r1.DELETE("/:id", handler.Delete)
}

func (h *recordHandler) Read(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.recordService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	record, err := h.recordService.GetByExample(c.Request().Context(), models.Record{ID: id})
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error reading record: %w", err))
	}

	return responses.SuccessWithData(c, record)
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

func (h *recordHandler) Update(c echo.Context) error {
	req := requests.RecordRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}
	req.ID = &id

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	req.UserID = &claims.UserID

	isOwner, err := h.recordService.IsOwner(c.Request().Context(), *req.UserID, *req.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	record, err := h.recordService.Update(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error updating record: %w", err))
	}

	return responses.SuccessWithData(c, record)
}

func (h *recordHandler) Delete(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.recordService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	err = h.recordService.Delete(c.Request().Context(), id)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error deleting record: %w", err))
	}

	return responses.Success(c)
}
