package handlers

import (
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/emilijan-koteski/monexa/internal/services"
	"github.com/labstack/echo/v4"
)

type healthHandler struct {
	healthService *services.HealthService
}

func RegisterHealthHandler(e *echo.Echo, healthService *services.HealthService) {
	handler := &healthHandler{healthService: healthService}

	// Unauthenticated group
	v1 := e.Group("/api/v1/health")

	v1.GET("", handler.CheckHealth)

	// Restricted group
	r1 := v1.Group("")
	r1.Use(middlewares.AuthMiddleware())

	r1.GET("/restricted", handler.CheckHealth)
}

func (h *healthHandler) CheckHealth(c echo.Context) error {
	isHealthy := h.healthService.CheckHealth()

	if isHealthy {
		return responses.Success(c)
	}

	return responses.ServiceUnavailable(c)
}
