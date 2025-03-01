package server

import (
	"fmt"
	"github.com/labstack/echo/v4"
	"log"
	"os"
)

func StartServer(e *echo.Echo) {
	serverPort := os.Getenv("SERVER_PORT")
	address := fmt.Sprintf(":%s", serverPort)

	err := e.Start(address)
	if err != nil {
		log.Fatalf("⛔ Exit!!! Cannot start HTTP server on port: %s", serverPort)
	}
}
