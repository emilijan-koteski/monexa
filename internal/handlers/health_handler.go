package handlers

import (
	"github.com/emilijan-koteski/monexa/internal/handlers/responses"
	"github.com/emilijan-koteski/monexa/internal/middlewares"
	"github.com/labstack/echo/v4"
)

// HealthChecker reports whether the service's dependencies (the database) are reachable.
type HealthChecker interface {
	CheckHealth() bool
}

type healthHandler struct {
	healthService HealthChecker
}

// RegisterHealthHandler registers the health routes, including the unauthenticated /healthz probe
// that Dokploy, Swarm and uptime monitors use to ping the database.
func RegisterHealthHandler(e *echo.Echo, healthService HealthChecker) {
	handler := &healthHandler{healthService: healthService}

	e.GET("/healthz", handler.CheckHealth)

	v1 := e.Group("/api/v1/health")

	v1.GET("", handler.CheckHealth)

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
