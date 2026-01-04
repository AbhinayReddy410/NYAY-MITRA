# NyayaMitra API Dockerfile
# Builds and runs the Hono API server on Cloud Run

# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY services/api ./services/api

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @nyayamitra/api...

# Build shared package
RUN pnpm --filter @nyayamitra/shared build

# Build API
RUN pnpm --filter @nyayamitra/api build

# Production stage
FROM node:20-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY services/api/package.json ./services/api/package.json

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter @nyayamitra/api... --prod

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/api/dist ./services/api/dist

# Set working directory to API
WORKDIR /app/services/api

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose Cloud Run port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start server
CMD ["node", "dist/index.js"]
