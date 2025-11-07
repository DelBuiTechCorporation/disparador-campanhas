FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

FROM node:20-alpine AS runtime

RUN apk add --no-cache openssl postgresql-client

WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY start.sh ./start.sh

RUN mkdir -p /app/data /app/uploads && chown -R nodejs:nodejs /app/data /app/uploads
RUN chmod +x start.sh && chown nodejs:nodejs start.sh
RUN chown -R nodejs:nodejs /app/node_modules/@prisma || true
RUN chmod -R 755 /app/node_modules/@prisma || true

USER nodejs

EXPOSE 3001

CMD ["./start.sh"]