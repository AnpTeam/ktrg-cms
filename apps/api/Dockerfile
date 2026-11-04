FROM oven/bun:1.4.3 AS runtime
WORKDIR /app
ENV NODE_ENV=production

# คัดลอก package configuration ทั้งระบบ Monorepo
COPY package.json bun.lock* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# สั่ง install เฉพาะ dependencies ของ api โดยตรงใน stage นี้ (แก้ปัญหา symlink ขาด 100%)
RUN bun install --production --frozen-lockfile --filter ./apps/api

# คัดลอก source code ของ api เข้ามา
COPY apps/api apps/api

# The uploads folder (a volume on the AWS server) must be the app user's, or it cannot write there.
RUN mkdir -p /data/uploads && chown bun:bun /data/uploads

USER bun
EXPOSE 3001

# กำหนด working directory เข้าไปที่ apps/api
WORKDIR /app/apps/api
CMD ["bun", "run", "src/server.ts"]