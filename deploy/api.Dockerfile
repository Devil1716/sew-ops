FROM node:24-bookworm-slim AS base
ENV NPM_CONFIG_FETCH_RETRIES=5 NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=2000 NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=30000 NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# 1. build: everything including dev tools; compiles the API and generates the database client
FROM base AS build
RUN npm ci --workspace @sew-ops/api
COPY apps/api apps/api
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build -w @sew-ops/api \
 && node -e "require('@node-rs/argon2'); require('@prisma/client'); console.log('native modules OK')"

# 2. tools: one-off jobs only (database migrations, creating the first admin). Never runs as a server.
FROM build AS tools
WORKDIR /repo/apps/api
CMD ["npx", "prisma", "migrate", "deploy"]

# 3. runtime: production libraries only, compiled code, non-root user
FROM base AS runtime
ENV NODE_ENV=production
RUN npm ci --workspace @sew-ops/api --omit=dev && npm cache clean --force
COPY --from=build /repo/node_modules/.prisma /repo/node_modules/.prisma
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
RUN node -e "require('@node-rs/argon2'); require('@prisma/client'); console.log('runtime native modules OK')"
USER node
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]