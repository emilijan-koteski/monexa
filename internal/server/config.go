package server

import (
	"log"
	"os"
	"strings"
)

const defaultPort = "8080"

// RequiredEnv lists the variables the process cannot run without. They are checked once at
// startup so a misconfigured container fails immediately, before connecting to the database,
// instead of dying later in a client constructor after migrations already ran.
var RequiredEnv = []string{
	"DATABASE_URL",
	"JWT_SECRET",
	"PPID_SECRET",
	"RESEND_API_KEY",
	"RESEND_FROM_NAME",
	"RESEND_FROM_ADDRESS",
	"FRONTEND_URL",
}

// ListenPort returns the TCP port the HTTP server binds to: PORT, or 8080 when unset.
func ListenPort() string {
	if port := os.Getenv("PORT"); port != "" {
		return port
	}
	return defaultPort
}

// CORSOrigins parses CORS_ORIGINS (comma-separated, whitespace tolerated).
// Unset allows any origin, which is acceptable for local development only.
func CORSOrigins() []string {
	raw := os.Getenv("CORS_ORIGINS")
	if strings.TrimSpace(raw) == "" {
		return []string{"https://*", "http://*"}
	}
	var origins []string
	for _, origin := range strings.Split(raw, ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}

// RequireEnv exits the process when any of the named variables is unset or empty.
func RequireEnv(names ...string) {
	if missing := missingEnv(names...); len(missing) > 0 {
		log.Fatalf("⛔ Exit!!! Missing required environment variables: %s", strings.Join(missing, ", "))
	}
}

func missingEnv(names ...string) []string {
	var missing []string
	for _, name := range names {
		if os.Getenv(name) == "" {
			missing = append(missing, name)
		}
	}
	return missing
}
