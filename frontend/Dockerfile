# ============================================
# MONEXA FRONTEND DOCKERFILE
# Multi-stage build: Node.js build -> Nginx serve
# ============================================

# --------------------------------------------
# Stage 1: Dependencies
# --------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --frozen-lockfile

# --------------------------------------------
# Stage 2: Build
# --------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build argument for API URL (injected at build time)
ARG VITE_API_BASE_URL=http://localhost:9000/api/v1

# Set environment variable for Vite build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the application
RUN npm run build

# --------------------------------------------
# Stage 3: Production
# --------------------------------------------
FROM nginx:1.25-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user and set permissions
RUN addgroup -g 1000 -S monexa && \
    adduser -u 1000 -S monexa -G monexa && \
    chown -R monexa:monexa /usr/share/nginx/html && \
    chown -R monexa:monexa /var/cache/nginx && \
    chown -R monexa:monexa /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R monexa:monexa /var/run/nginx.pid && \
    mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp && \
    chown -R monexa:monexa /tmp/*

# Switch to non-root user
USER monexa

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
