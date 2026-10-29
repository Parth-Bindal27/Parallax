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
