# ============================================
# MONEXA BACKEND DOCKERFILE
# Multi-stage build for minimal production image
# ============================================

# --------------------------------------------
# Stage 1: Build
# --------------------------------------------
FROM golang:1.23.6-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /build

# Copy dependency files first (better layer caching)
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download && go mod verify

# Copy source code
COPY cmd/ cmd/
COPY internal/ internal/

# Build the binary
# CGO_ENABLED=0 produces a statically linked binary
# -ldflags="-s -w" strips debug info for smaller binary
# -trimpath removes file system paths from binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -extldflags '-static'" \
    -trimpath \
    -o /build/monexa-api \
    ./cmd/api

# --------------------------------------------
# Stage 2: Production
# --------------------------------------------
FROM alpine:3.19

# Install runtime dependencies
# ca-certificates: for HTTPS calls (exchange rate API)
# tzdata: for proper timezone handling
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user for security
RUN addgroup -g 1000 -S monexa && \
    adduser -u 1000 -S monexa -G monexa

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/monexa-api /app/monexa-api

# Change ownership to non-root user
RUN chown -R monexa:monexa /app

# Switch to non-root user
USER monexa

# Expose API port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9000/api/v1/health || exit 1

# Run the binary
ENTRYPOINT ["/app/monexa-api"]
