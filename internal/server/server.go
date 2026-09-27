package server

import (
	"log"

	"github.com/labstack/echo/v4"
)

func StartServer(e *echo.Echo) {
	port := ListenPort()
	if err := e.Start(":" + port); err != nil {
		log.Fatalf("⛔ Exit!!! Cannot start HTTP server on port %s: %v", port, err)
	}
}
