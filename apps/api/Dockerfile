# Assumes the planned layout: Bun workspace root with apps/api and apps/web,
# and a server entry at apps/api/src/server.ts. Adjust once the app is scaffolded.
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --filter ./apps/api

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api ./apps/api
USER bun
EXPOSE 3001
CMD ["bun", "run", "apps/api/src/server.ts"]
