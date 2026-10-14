# Assumes apps/web/next.config sets `output: "standalone"`. Adjust once scaffolded.
FROM oven/bun:1.4.3 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --filter ./apps/web

FROM oven/bun:1.4.3 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/web
# next.config.ts bakes the /api/v1 rewrite target in at build time.
ARG API_ORIGIN=http://api:3001
ENV API_ORIGIN=$API_ORIGIN
RUN bun run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
