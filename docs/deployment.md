# PARALLAX Production Deployment Guide

## 1. Production Architecture Overview
In production, PARALLAX runs as a modular monolith:
- A unified Node.js/Express service serves the REST API (`/api/v1/*`), Server-Sent Events, and the precompiled React single-page application.
- Real Playwright Chromium runs headlessly in a containerized Linux environment with necessary system libraries (`libnss3`, `libatk`, `libcups2`, etc.).
- SQLite database persists mission state, snapshots, evidence, and claims in a persistent storage volume (`/app/data`).

---

## 2. Docker Deployment

### 2.1 Multi-Stage Dockerfile (`Dockerfile`)
```dockerfile
# Stage 1: Build Shared and Apps
FROM node:24-bookworm-slim AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production Runner with Playwright Dependencies
FROM node:24-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV ALLOW_LOCAL_FIXTURES=false
ENV SSRF_PROTECTION_ENABLED=true

# Install Playwright browser dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Install Playwright Chromium in production image
RUN npx playwright install chromium

# Create persistent storage directories
RUN mkdir -p /app/data/snapshots /app/data/artifacts

EXPOSE 3001
VOLUME ["/app/data"]

CMD ["node", "apps/server/dist/index.js"]
```

### 2.2 Docker Compose (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  parallax:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: parallax-app
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_PATH=/app/data/parallax.db
      - SNAPSHOT_STORAGE_PATH=/app/data/snapshots
      - ARTIFACT_STORAGE_PATH=/app/data/artifacts
      - ALLOW_LOCAL_FIXTURES=false
      - SSRF_PROTECTION_ENABLED=true
      - LLM_PROVIDER=openai # or anthropic, gemini, demo
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_MODEL=gpt-4o-mini
    volumes:
      - parallax_data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  parallax_data:
    driver: local
```

---

## 3. Reverse Proxy Configuration (Nginx)

When deploying behind Nginx, configure SSE buffering and timeout parameters to prevent stream truncation:

```nginx
server {
    listen 80;
    server_name parallax.example.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Disable buffering for Server-Sent Events (SSE)
    location /api/v1/missions/.*/events {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 24h;
    }
}
```
