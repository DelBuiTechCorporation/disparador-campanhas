# Multi-stage Dockerfile for Astra Campaign
# Builds both frontend and backend, serves frontend statically from backend

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# Stage 3: Runtime
FROM node:20-alpine AS runtime

ARG TIMEZONE=America/Sao_Paulo

RUN apk add --no-cache openssl postgresql-client tzdata

WORKDIR /app

# Set timezone
ENV TZ=${TIMEZONE}
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy backend
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/start.sh ./start.sh

# Copy frontend build to public directory
COPY --from=frontend-builder /app/frontend/dist ./public

# Create necessary directories and set permissions
RUN mkdir -p /app/data /app/uploads /app/backups && chown -R nodejs:nodejs /app/data /app/uploads /app/backups /app/public
RUN chmod +x start.sh && chown nodejs:nodejs start.sh
RUN chown -R nodejs:nodejs /app/node_modules
RUN chmod -R 755 /app/node_modules

USER nodejs

EXPOSE 3001

CMD ["./start.sh"]