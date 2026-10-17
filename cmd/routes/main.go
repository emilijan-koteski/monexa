package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/emilijan-koteski/monexa/internal/routes"
	"github.com/emilijan-koteski/monexa/internal/server"
	"github.com/labstack/echo/v4"
)

const (
	inventoryPath           = "docs/api-routes.json"
	regenerateCmd           = "go run ./cmd/routes -write"
	placeholderClientSecret = "0123456789abcdef0123456789abcdef"
)

type route struct {
	Method string `json:"method"`
	Path   string `json:"path"`
}

func main() {
	write := flag.Bool("write", false, "write "+inventoryPath+" instead of checking it")
	check := flag.Bool("check", false, "compare "+inventoryPath+" with the registered routes (default)")
	flag.Parse()

	if *write && *check {
		exitWith("-write and -check are mutually exclusive")
	}

	generated, err := render(collectRoutes())
	if err != nil {
		exitWith("rendering routes: %v", err)
	}

	if *write {
		writeInventory(generated)
		return
	}
	checkInventory(generated)
}

func collectRoutes() []route {
	e := echo.New()
	routes.Register(e, routes.Deps{
		OAuthConfig: &server.OAuthConfig{
			IssuerURL:       "https://issuer.invalid",
			ResourceURL:     "https://mcp.invalid/mcp",
			MCPClientID:     "x",
			MCPClientSecret: placeholderClientSecret,
			AccessTokenTTL:  time.Hour,
			RefreshTokenTTL: time.Hour,
		},
		FrontendURL:            "https://frontend.invalid",
		LegalComplianceEnabled: true,
	})
	return normalize(e.Routes())
}

func normalize(registered []*echo.Route) []route {
	seen := make(map[route]bool)
	inventory := []route{}
	for _, r := range registered {
		entry := route{Method: r.Method, Path: r.Path}
		if !isAPIMethod(entry.Method) || seen[entry] {
			continue
		}
		seen[entry] = true
		inventory = append(inventory, entry)
	}
	sort.Slice(inventory, func(i, j int) bool {
		if inventory[i].Path != inventory[j].Path {
			return inventory[i].Path < inventory[j].Path
		}
		return inventory[i].Method < inventory[j].Method
	})
	return inventory
}

func isAPIMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	}
	return false
}

func render(inventory []route) ([]byte, error) {
	data, err := json.MarshalIndent(inventory, "", "  ")
	if err != nil {
		return nil, err
	}
	return append(data, '\n'), nil
}

func writeInventory(generated []byte) {
	if _, err := os.Stat(filepath.Dir(inventoryPath)); err != nil {
		exitWith("cannot find the docs directory (%v); run this command from the repository root", err)
	}
	if err := os.WriteFile(inventoryPath, generated, 0o644); err != nil {
		exitWith("writing %s: %v", inventoryPath, err)
	}
	fmt.Printf("wrote %s\n", inventoryPath)
}

func checkInventory(generated []byte) {
	committed, err := os.ReadFile(inventoryPath)
	if errors.Is(err, os.ErrNotExist) {
		exitWith("%s does not exist; run this command from the repository root, or create it with: %s", inventoryPath, regenerateCmd)
	}
	if err != nil {
		exitWith("reading %s: %v", inventoryPath, err)
	}
	if string(committed) == string(generated) {
		fmt.Printf("%s is up to date\n", inventoryPath)
		return
	}

	fmt.Fprintf(os.Stderr, "%s is out of date.\n", inventoryPath)
	var previous, current []route
	if err := json.Unmarshal(committed, &previous); err != nil {
		fmt.Fprintf(os.Stderr, "The file is not a valid route list (%v).\n", err)
	} else if err := json.Unmarshal(generated, &current); err == nil {
		printDifference(previous, current)
	}
	fmt.Fprintf(os.Stderr, "Regenerate it with: %s\n", regenerateCmd)
	os.Exit(1)
}

func printDifference(previous, current []route) {
	added, removed := difference(current, previous), difference(previous, current)
	for _, r := range added {
		fmt.Fprintf(os.Stderr, "  + %s %s (registered but missing from the file)\n", r.Method, r.Path)
	}
	for _, r := range removed {
		fmt.Fprintf(os.Stderr, "  - %s %s (in the file but no longer registered)\n", r.Method, r.Path)
	}
	if len(added) == 0 && len(removed) == 0 {
		fmt.Fprintln(os.Stderr, "The routes match but the file formatting or order differs.")
	}
}

func difference(from, other []route) []route {
	known := make(map[route]bool, len(other))
	for _, r := range other {
		known[r] = true
	}
	var result []route
	for _, r := range from {
		if !known[r] {
			result = append(result, r)
		}
	}
	return result
}

func exitWith(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "routes: "+format+"\n", args...)
	os.Exit(1)
}
