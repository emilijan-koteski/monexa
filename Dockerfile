# syntax=docker/dockerfile:1

# ---- build -------------------------------------------------------------
FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY cmd/ cmd/
COPY internal/ internal/

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/monexa-api ./cmd/api

# ---- runtime -----------------------------------------------------------
FROM alpine:3.22

# ca-certificates: outbound HTTPS (exchange rates, Resend); tzdata: time zones
RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -u 1000 monexa

WORKDIR /app
COPY --from=builder /out/monexa-api ./monexa-api
COPY templates/ ./templates/

USER monexa

ENV PORT=8080
EXPOSE 8080

# Dokploy/Swarm can run the same probe: wget -qO- http://127.0.0.1:8080/healthz
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1

ENTRYPOINT ["/app/monexa-api"]
