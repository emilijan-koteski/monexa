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

type recurringExpenseHandler struct {
	recurringExpenseService *services.RecurringExpenseService
}

func RegisterRecurringExpenseHandler(e *echo.Echo, recurringExpenseService *services.RecurringExpenseService, restrictedMiddlewares ...echo.MiddlewareFunc) {
	handler := &recurringExpenseHandler{recurringExpenseService: recurringExpenseService}

	// Unauthenticated group
	v1 := e.Group("/api/v1/recurring-expenses")

	// Restricted group
	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())
	for _, m := range restrictedMiddlewares {
		r1.Use(m)
	}

	r1.GET("/:id", handler.Read)
	r1.GET("", handler.ReadAll)
	r1.POST("", handler.Create)
	r1.PATCH("/:id", handler.Update)
	r1.DELETE("/:id", handler.Delete)
}

func (h *recurringExpenseHandler) Read(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.recurringExpenseService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	recurringExpense, err := h.recurringExpenseService.GetByExample(c.Request().Context(), models.RecurringExpense{ID: id})
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error reading recurring expense: %w", err))
	}

	return responses.SuccessWithData(c, recurringExpense)
}

func (h *recurringExpenseHandler) ReadAll(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	recurringExpenses, err := h.recurringExpenseService.GetAll(c.Request().Context(), claims.UserID)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error reading recurring expenses: %w", err))
	}

	return responses.SuccessWithData(c, recurringExpenses)
}

func (h *recurringExpenseHandler) Create(c echo.Context) error {
	req := requests.RecurringExpenseRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	req.UserID = &claims.UserID

	recurringExpense, err := h.recurringExpenseService.Create(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error creating recurring expense: %w", err))
	}

	return responses.SuccessWithData(c, recurringExpense)
}

func (h *recurringExpenseHandler) Update(c echo.Context) error {
	req := requests.RecurringExpenseRequest{}
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

	isOwner, err := h.recurringExpenseService.IsOwner(c.Request().Context(), *req.UserID, *req.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	recurringExpense, err := h.recurringExpenseService.Update(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error updating recurring expense: %w", err))
	}

	return responses.SuccessWithData(c, recurringExpense)
}

func (h *recurringExpenseHandler) Delete(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.recurringExpenseService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	err = h.recurringExpenseService.Delete(c.Request().Context(), id)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error deleting recurring expense: %w", err))
	}

	return responses.Success(c)
}
