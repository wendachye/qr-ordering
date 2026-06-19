# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY prisma ./prisma
# Prisma 7 reads the schema path + datasource from prisma.config.ts (the schema
# datasource no longer carries the url), so generate needs it present.
COPY prisma.config.ts ./
RUN pnpm exec prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ---- runtime stage ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile && pnpm store prune
# The generated Prisma client. Prisma 7 ships a WASM query compiler (no native
# engine binary), so this is just the thin generated client — not an engine that
# has to match the base image's libc.
# NOTE: pnpm's symlinked node_modules can place the generated client under
# node_modules/.pnpm/... — verify this COPY path against a real `docker build`
# before deploying (you may instead re-run `pnpm exec prisma generate` here).
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
# Writable uploads dir for local-storage container runs (S3 deploys don't use it).
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
EXPOSE 4000
USER node
# Migrations are NOT run from this image — it ships no prisma CLI (--prod) and
# no prisma.config.ts. Run them from the CI/release runner at the repo root
# (`pnpm exec prisma migrate deploy`), which has both — see .github/workflows/ci.yml.
# tsconfig preserves the source tree under dist/, so the entry is dist/src/server.js.
CMD ["node", "dist/src/server.js"]
