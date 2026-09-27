# syntax=docker/dockerfile:1

# ---- build -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked in at build time: there is exactly one production configuration.
ARG VITE_API_BASE_URL
ARG VITE_LEGAL_COMPLIANCE_ENABLED=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_LEGAL_COMPLIANCE_ENABLED=$VITE_LEGAL_COMPLIANCE_ENABLED

RUN test -n "$VITE_API_BASE_URL" || { echo "build arg VITE_API_BASE_URL is required" >&2; exit 1; }
RUN npm run build

# ---- runtime -----------------------------------------------------------
# Non-root nginx (uid 101) that listens on 8080; pid and temp files live in /tmp.
FROM nginxinc/nginx-unprivileged:1.28-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
