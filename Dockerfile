# ─── Base ────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY package*.json ./

# ─── Development ──────────────────────────────────────────────────
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000 9229
CMD ["npm", "run", "start:dev"]

# ─── Builder ──────────────────────────────────────────────────────
FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

# ─── Production ───────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
WORKDIR /app

# Create non-root user
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs

COPY --from=builder --chown=nestjs:nestjs /app/dist ./dist
COPY --from=builder --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --chown=nestjs:nestjs package*.json ./

USER nestjs
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
