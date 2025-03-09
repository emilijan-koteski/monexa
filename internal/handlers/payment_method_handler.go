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

type paymentMethodHandler struct {
	paymentMethodService *services.PaymentMethodService
}

func RegisterPaymentMethodHandler(e *echo.Echo, paymentMethodService *services.PaymentMethodService) {
	handler := &paymentMethodHandler{paymentMethodService: paymentMethodService}

	// Unauthenticated group
	v1 := e.Group("/api/v1/payment-methods")

	// Restricted group
	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())

	r1.GET("/:id", handler.Read)
	r1.GET("", handler.ReadAll)
	r1.POST("", handler.Create)
	r1.PATCH("/:id", handler.Update)
	r1.DELETE("/:id", handler.Delete)
}

func (h *paymentMethodHandler) Read(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.paymentMethodService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	paymentMethod, err := h.paymentMethodService.GetByExample(c.Request().Context(), models.PaymentMethod{ID: id})
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error reading payment method: %w", err))
	}

	return responses.SuccessWithData(c, paymentMethod)
}

func (h *paymentMethodHandler) ReadAll(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	paymentMethods, err := h.paymentMethodService.GetAllByExample(c.Request().Context(), models.PaymentMethod{UserID: claims.UserID})
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error reading payment methods: %w", err))
	}

	return responses.SuccessWithData(c, paymentMethods)
}

func (h *paymentMethodHandler) Create(c echo.Context) error {
	req := requests.PaymentMethodRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	req.UserID = &claims.UserID

	paymentMethod, err := h.paymentMethodService.Create(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error creating payment method: %w", err))
	}

	return responses.SuccessWithData(c, paymentMethod)
}

func (h *paymentMethodHandler) Update(c echo.Context) error {
	req := requests.PaymentMethodRequest{}
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

	isOwner, err := h.paymentMethodService.IsOwner(c.Request().Context(), *req.UserID, *req.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	paymentMethod, err := h.paymentMethodService.Update(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error updating payment method: %w", err))
	}

	return responses.SuccessWithData(c, paymentMethod)
}

func (h *paymentMethodHandler) Delete(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.paymentMethodService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	err = h.paymentMethodService.Delete(c.Request().Context(), id)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error deleting payment method: %w", err))
	}

	return responses.Success(c)
}
