package server

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
)

const shutdownTimeout = 10 * time.Second

// StartServer serves HTTP on ListenPort() and blocks until SIGINT or SIGTERM, then drains
// in-flight requests for up to shutdownTimeout. Swarm sends SIGTERM on every redeploy.
func StartServer(e *echo.Echo) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(quit)

	port := ListenPort()
	go func() {
		if err := e.Start(":" + port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("⛔ Exit!!! Cannot start HTTP server on port %s: %v", port, err)
		}
	}()

	sig := <-quit
	log.Printf("👋 Received %s, shutting down HTTP server...", sig)

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		log.Printf("🛑 Error!!! HTTP server shutdown: %v", err)
	}
}
