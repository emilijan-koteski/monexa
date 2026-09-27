package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

type stubHealth struct{ healthy bool }

func (s stubHealth) CheckHealth() bool { return s.healthy }

func newHealthServer(t *testing.T, healthy bool) *echo.Echo {
	t.Helper()
	t.Setenv("JWT_SECRET", "test-secret")
	e := echo.New()
	RegisterHealthHandler(e, stubHealth{healthy: healthy})
	return e
}

func TestHealthzReturns200WhenDatabaseReachable(t *testing.T) {
	e := newHealthServer(t, true)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /healthz = %d, want 200; body %s", rec.Code, rec.Body)
	}
}

func TestHealthzReturns503WhenDatabaseUnreachable(t *testing.T) {
	e := newHealthServer(t, false)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("GET /healthz = %d, want 503; body %s", rec.Code, rec.Body)
	}
}

func TestLegacyHealthRouteStillWorks(t *testing.T) {
	e := newHealthServer(t, true)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/health", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/v1/health = %d, want 200", rec.Code)
	}
}
