FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=apps/backend --workspace=packages/shared --include-workspace-root

# Build shared package
FROM deps AS shared-build
COPY packages/shared/ ./packages/shared/
RUN npm run build --workspace=packages/shared

# Build backend
FROM shared-build AS build
COPY apps/backend/ ./apps/backend/
RUN cd apps/backend && npx prisma generate
RUN npm run build --workspace=apps/backend

# Production
FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /app/apps/backend/package.json ./apps/backend/
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY apps/backend/docker-entrypoint.sh ./apps/backend/

WORKDIR /app/apps/backend
RUN chmod +x docker-entrypoint.sh
RUN mkdir -p /app/apps/backend/uploads
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
