package handlers

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/models/types"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/emilijan-koteski/monexa/internal/utils"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type trendReportHandler struct {
	trendReportService *services.TrendReportService
}

func RegisterTrendReportHandler(e *echo.Echo, trendReportService *services.TrendReportService) {
	handler := &trendReportHandler{trendReportService: trendReportService}

	// Unauthenticated group
	v1 := e.Group("/api/v1/trend-reports")

	// Restricted group
	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())

	r1.GET("", handler.ReadAll)
	r1.GET("/:id", handler.Read)
	r1.POST("", handler.Create)
	r1.PATCH("/:id", handler.Update)
	r1.DELETE("/:id", handler.Delete)
	r1.GET("/:id/monthly-data", handler.GetMonthlyData)
	r1.GET("/:id/monthly-details", handler.GetMonthlyDetails)
}

func (h *trendReportHandler) ReadAll(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	reports, err := h.trendReportService.GetAll(c.Request().Context(), claims.UserID)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error fetching trend reports: %w", err))
	}

	return responses.SuccessWithData(c, reports)
}

func (h *trendReportHandler) Read(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.trendReportService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	report, err := h.trendReportService.GetByID(c.Request().Context(), id)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error fetching trend report: %w", err))
	}

	return responses.SuccessWithData(c, report)
}

func (h *trendReportHandler) Create(c echo.Context) error {
	req := requests.TrendReportRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}
	req.UserID = &claims.UserID

	report, err := h.trendReportService.Create(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error creating trend report: %w", err))
	}

	return responses.SuccessWithData(c, report)
}

func (h *trendReportHandler) Update(c echo.Context) error {
	req := requests.TrendReportRequest{}
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

	isOwner, err := h.trendReportService.IsOwner(c.Request().Context(), *req.UserID, *req.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	report, err := h.trendReportService.Update(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error updating trend report: %w", err))
	}

	return responses.SuccessWithData(c, report)
}

func (h *trendReportHandler) Delete(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.trendReportService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	if err := h.trendReportService.Delete(c.Request().Context(), id); err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error deleting trend report: %w", err))
	}

	return responses.Success(c)
}

func (h *trendReportHandler) GetMonthlyData(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.trendReportService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	yearStr := c.QueryParam("year")
	if yearStr == "" {
		return responses.BadRequestWithMessage(c, "year query parameter is required")
	}
	year, err := strconv.Atoi(yearStr)
	if err != nil || year <= 0 {
		return responses.BadRequestWithMessage(c, "invalid year parameter")
	}

	var categoryType *types.CategoryType
	if typeStr := c.QueryParam("type"); typeStr != "" {
		ct := types.CategoryType(typeStr)
		if !types.IsValidCategoryType(ct) {
			return responses.BadRequestWithMessage(c, "invalid type parameter: must be INCOME or EXPENSE")
		}
		categoryType = &ct
	}

	data, err := h.trendReportService.GetMonthlyData(c.Request().Context(), requests.TrendReportMonthlyDataRequest{
		ReportID: id,
		UserID:   claims.UserID,
		Year:     year,
		Type:     categoryType,
	})
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error fetching monthly data: %w", err))
	}

	return responses.SuccessWithData(c, data)
}

func (h *trendReportHandler) GetMonthlyDetails(c echo.Context) error {
	id, err := utils.ParseIDParam(c)
	if err != nil {
		return responses.BadRequestWithError(c, err)
	}

	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.BadRequestWithMessage(c, "no logged in user")
	}

	isOwner, err := h.trendReportService.IsOwner(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return responses.NotFound(c)
		}
		return responses.FailureWithError(c, err)
	}
	if !isOwner {
		return responses.Unauthorized(c)
	}

	yearStr := c.QueryParam("year")
	if yearStr == "" {
		return responses.BadRequestWithMessage(c, "year query parameter is required")
	}
	year, err := strconv.Atoi(yearStr)
	if err != nil || year <= 0 {
		return responses.BadRequestWithMessage(c, "invalid year parameter")
	}

	var categoryType *types.CategoryType
	if typeStr := c.QueryParam("type"); typeStr != "" {
		ct := types.CategoryType(typeStr)
		if !types.IsValidCategoryType(ct) {
			return responses.BadRequestWithMessage(c, "invalid type parameter: must be INCOME or EXPENSE")
		}
		categoryType = &ct
	}

	data, err := h.trendReportService.GetMonthlyDetails(c.Request().Context(), requests.TrendReportMonthlyDataRequest{
		ReportID: id,
		UserID:   claims.UserID,
		Year:     year,
		Type:     categoryType,
	})
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error fetching monthly details: %w", err))
	}

	return responses.SuccessWithData(c, data)
}
