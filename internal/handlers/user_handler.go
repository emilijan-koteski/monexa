package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	dtotypes "github.com/emilijan-koteski/monexa/internal/dtos/types"
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/models"
	"github.com/emilijan-koteski/monexa/internal/requests"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/labstack/echo/v4"
)

type userHandler struct {
	userService   *services.UserService
	exportService *services.ExportService
}

func RegisterUserHandler(e *echo.Echo, userService *services.UserService, exportService *services.ExportService, restrictedMiddlewares ...echo.MiddlewareFunc) {
	handler := &userHandler{userService: userService, exportService: exportService}

	v1 := e.Group("/api/v1/users")

	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())
	for _, m := range restrictedMiddlewares {
		r1.Use(m)
	}

	r1.GET("/me", handler.GetMe)
	r1.PATCH("", handler.Update)
	r1.GET("/data/export", handler.ExportData)
}

func (h *userHandler) GetMe(c echo.Context) error {
	claims, err := middlewares.GetUserClaims(c)
	if err != nil {
		return responses.UnauthorizedWithMessage(c, "not authenticated")
	}

	user, err := h.userService.GetUserByExample(c.Request().Context(), models.User{ID: claims.UserID})
	if err != nil {
		return responses.FailureWithMessage(c, "user not found")
	}

	return responses.SuccessWithData(c, user)
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

	format := dtotypes.ExportFormatType(c.QueryParam("format"))
	if format == "" {
		format = dtotypes.ExportFormatCSV
	}
	if !dtotypes.ValidExportFormats[format] {
		return responses.BadRequestWithMessage(c, "invalid format, expected csv or json")
	}

	var categories []dtotypes.ExportCategoryType
	if cats := c.QueryParam("categories"); cats != "" {
		for _, cat := range strings.Split(cats, ",") {
			ec := dtotypes.ExportCategoryType(cat)
			if !dtotypes.ValidExportCategories[ec] {
				return responses.BadRequestWithMessage(c, fmt.Sprintf("invalid category: %s", cat))
			}
			categories = append(categories, ec)
		}
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

	req := requests.ExportRequest{
		UserID:     claims.UserID,
		Format:     format,
		Categories: categories,
		StartDate:  startDate,
		EndDate:    endDate,
	}

	zipBytes, err := h.exportService.ExportData(c.Request().Context(), req)
	if err != nil {
		return responses.FailureWithError(c, fmt.Errorf("error exporting data: %w", err))
	}

	filename := fmt.Sprintf("monexa-data-export-%s.zip", time.Now().Format("2006-01-02"))

	c.Response().Header().Set("Content-Type", "application/zip")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Response().Header().Set("Content-Length", strconv.Itoa(len(zipBytes)))

	return c.Blob(http.StatusOK, "application/zip", zipBytes)
}
