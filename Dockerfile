# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base

WORKDIR /usr/src/app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN apk add --no-cache libc6-compat openssl \
  && corepack enable \
  && corepack prepare pnpm@10.30.3 --activate

COPY package.json pnpm-lock.yaml ./


FROM base AS deps

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile


FROM deps AS build

ENV NODE_OPTIONS=--max-old-space-size=4096

COPY . .

# Prisma v7 reads DATABASE_URL from prisma.config.ts during generation.
# A dummy value is enough for generating the client at build time.
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
ENV DATABASE_URL=$DATABASE_URL

RUN pnpm prisma generate \
  && pnpm build


FROM base AS prod-deps

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --prod --frozen-lockfile \
  && rm -rf \
    node_modules/.pnpm/@electric-sql+pglite* \
  && rm -rf node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/generator-build \
  && find node_modules -type f \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' -o -name 'README*' -o -name 'LICENSE*' \) -delete \
  && find node_modules/.pnpm -path '*/@prisma/client/runtime/query_compiler*' \
    ! -name '*postgresql*' -delete


FROM node:22-alpine AS production

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache libc6-compat openssl \
  && addgroup -S nodejs \
  && adduser -S nestjs -G nodejs

COPY --from=prod-deps --chown=nestjs:nodejs /usr/src/app/package.json ./package.json
COPY --from=prod-deps --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /usr/src/app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /usr/src/app/prisma.config.ts ./prisma.config.ts

USER nestjs

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
