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

type categoryHandler struct {
	categoryService *services.CategoryService
}

func RegisterCategoryHandler(e *echo.Echo, categoryService *services.CategoryService) {
	handler := &categoryHandler{categoryService: categoryService}

	// Unauthenticated group
	v1 := e.Group("/api/v1/categories")

	// Restricted group
	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())

	r1.GET("/:id", handler.Read)
	r1.GET("", handler.ReadAll)
	r1.POST("", handler.Create)
	r1.PATCH("/:id", handler.Update)
	r1.DELETE("/:id", handler.Delete)
	r1.GET("/statistics", handler.GetStatistics)
}

func (h *categoryHandler) Read(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.categoryService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	category, err := h.categoryService.GetByExample(c.Request().Context(), models.Category{ID: id})
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error reading category: %w", err))
	}

	return responses.SuccessWithData(c, category)
}

func (h *categoryHandler) ReadAll(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	categories, err := h.categoryService.GetAllByExample(c.Request().Context(), models.Category{UserID: claims.UserID})
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error reading categories: %w", err))
	}

	return responses.SuccessWithData(c, categories)
}

func (h *categoryHandler) Create(c echo.Context) error {
	req := requests.CategoryRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	req.UserID = &claims.UserID

	category, err := h.categoryService.Create(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error creating category: %w", err))
	}

	return responses.SuccessWithData(c, category)
}

func (h *categoryHandler) Update(c echo.Context) error {
	req := requests.CategoryRequest{}
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

	isOwner, err := h.categoryService.IsOwner(c.Request().Context(), *req.UserID, *req.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	category, err := h.categoryService.Update(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error updating category: %w", err))
	}

	return responses.SuccessWithData(c, category)
}

func (h *categoryHandler) Delete(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.categoryService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	err = h.categoryService.Delete(c.Request().Context(), id)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error deleting category: %w", err))
	}

	return responses.Success(c)
}

func (h *categoryHandler) GetStatistics(c echo.Context) error {
	var filter requests.CategoryStatisticsRequest
	if err := c.Bind(&filter); err != nil {
		return responses.BadRequestWithMessage(c, "invalid query parameters")
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	filter.UserID = &claims.UserID

	stats, err := h.categoryService.GetStatistics(c.Request().Context(), filter)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, fmt.Errorf("error calculating statistics: %w", err))
	}

	return responses.SuccessWithData(c, stats)
}
