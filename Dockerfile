# Stage 1: Build frontend and server bundle
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json ./

# Install all dependencies for build
RUN npm ci

# Copy source and config files
COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
COPY server/ ./server/

# Build production assets (dist/ and dist-server/)
RUN npm run build

# Stage 2: Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV DOCKER=true
ENV HOST=0.0.0.0
ENV PORT=3001

# Copy dependency specifications and install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy build artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# Expose production port
EXPOSE 3001

# Run the unified server serving static frontend and API
CMD ["node", "dist-server/index.mjs", "--production"]
