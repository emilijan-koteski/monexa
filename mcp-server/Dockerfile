# syntax=docker/dockerfile:1

# ---- build -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src/ src/
RUN npm run build

# ---- runtime -----------------------------------------------------------
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY assets/ ./assets/

USER node

EXPOSE 8080

# The start period covers the startup wait for the backend's OAuth metadata (up to 30 attempts, 2 s apart).
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1

CMD ["node", "dist/index.js"]
