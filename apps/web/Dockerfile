# apps/web/next.config sets `output: "standalone"`.
FROM oven/bun:1.4.3 AS build
WORKDIR /app
COPY package.json bun.lock* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Install in this stage: Bun links each workspace's packages into apps/<name>/node_modules,
# so copying only the root node_modules from another stage loses them (lingui, next).
RUN bun install --frozen-lockfile --filter ./apps/web
COPY . .
WORKDIR /app/apps/web
# next.config.ts bakes the /api/v1 rewrite target in at build time.
ARG API_ORIGIN=http://api:3001
ENV API_ORIGIN=$API_ORIGIN
# The security header (src/lib/csp) lists these hosts; empty falls back to any R2 bucket.
ARG R2_UPLOAD_HOST=
ARG R2_PUBLIC_HOST=
ENV R2_UPLOAD_HOST=$R2_UPLOAD_HOST R2_PUBLIC_HOST=$R2_PUBLIC_HOST
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
