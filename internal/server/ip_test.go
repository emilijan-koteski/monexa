package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIPExtractor(t *testing.T) {
	extract := ClientIPExtractor()

	tests := []struct {
		name       string
		remoteAddr string
		xff        string
		want       string
	}{
		{"client via Cloudflare then Traefik on the overlay", "10.0.1.7:4321", "203.0.113.5, 104.16.1.1", "203.0.113.5"},
		{"client via Cloudflare IPv6 edge", "10.0.1.7:4321", "2001:db8::1, 2606:4700::1", "2001:db8::1"},
		{"Cloudflare bypassed, Traefik appended the peer", "10.0.1.7:4321", "198.51.100.9", "198.51.100.9"},
		{"spoofed header from an untrusted peer is ignored", "10.0.1.7:4321", "1.2.3.4, 198.51.100.9", "198.51.100.9"},
		{"no proxy at all", "198.51.100.9:443", "", "198.51.100.9"},
		{"every hop trusted falls back to the furthest", "10.0.1.7:4321", "104.16.1.1", "104.16.1.1"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.RemoteAddr = tt.remoteAddr
			if tt.xff != "" {
				req.Header.Set("X-Forwarded-For", tt.xff)
			}
			if got := extract(req); got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}
