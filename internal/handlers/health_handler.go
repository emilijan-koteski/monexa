package handlers

import (
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/labstack/echo/v4"
)

type HealthHandler struct {
	healthService *services.HealthService
}

func RegisterHealthHandler(e *echo.Echo, healthService *services.HealthService) {
	handler := &HealthHandler{healthService: healthService}

	v1 := e.Group("/api/v1/health")

	v1.GET("", handler.CheckHealth)
}

func (h *HealthHandler) CheckHealth(c echo.Context) error {
	isHealthy := h.healthService.CheckHealth()

	if isHealthy {
		return responses.Success(c)
	}

	return responses.ServiceUnavailable(c)
}
