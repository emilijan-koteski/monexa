package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/labstack/echo/v4"
)

type userHandler struct {
	userService   *services.UserService
	exportService *services.ExportService
}

func RegisterUserHandler(e *echo.Echo, userService *services.UserService, exportService *services.ExportService) {
	handler := &userHandler{userService: userService, exportService: exportService}

	v1 := e.Group("/api/v1/users")

	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())

	r1.PATCH("", handler.Update)
	r1.GET("/data/export", handler.ExportData)
}

func (h *userHandler) Update(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	req := requests.UpdateUserRequest{}
	if err := c.Bind(&req); err != nil {
		return responses.BadRequestWithMessage(c, "invalid input")
	}

	user, err := h.userService.UpdateUser(c.Request().Context(), claims.UserID, req)
	if err != nil {
		return responses.BadRequestWithMessage(c, err.Error())
	}

	return responses.SuccessWithData(c, user)
}

func (h *userHandler) ExportData(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	var startDate, endDate *time.Time

	if sd := c.QueryParam("startDate"); sd != "" {
		parsed, err := time.Parse("2006-01-02", sd)
		if err != nil {
			return responses.BadRequestWithMessage(c, "invalid startDate format, expected YYYY-MM-DD")
		}
		startDate = &parsed
	}

	if ed := c.QueryParam("endDate"); ed != "" {
		parsed, err := time.Parse("2006-01-02", ed)
		if err != nil {
			return responses.BadRequestWithMessage(c, "invalid endDate format, expected YYYY-MM-DD")
		}
		endDate = &parsed
	}

	csvBytes, err := h.exportService.ExportRecordsCSV(c.Request().Context(), claims.UserID, startDate, endDate)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error exporting data: %w", err))
	}

	filename := fmt.Sprintf("monexa-export-%s.csv", time.Now().Format("2006-01-02"))

	c.Response().Header().Set("Content-Type", "text/csv; charset=utf-8")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	return c.Blob(http.StatusOK, "text/csv; charset=utf-8", csvBytes)
}
