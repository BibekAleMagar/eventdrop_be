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

# Build Arguments (ARGS) to prevent the build from crashing if your NestJS 
# config module validates presence of variables during 'pnpm build'
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
ARG JWT_SECRET=""
ARG JWT_EXPIRES_IN=""
ARG GOOGLE_CLIENT_ID=""
ARG GOOGLE_CLIENT_SECRET=""

ENV DATABASE_URL=$DATABASE_URL \
  JWT_SECRET=$JWT_SECRET \
  JWT_EXPIRES_IN=$JWT_EXPIRES_IN \
  GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
  GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET

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
# Hugging Face mandates port 7860
ENV PORT=7860

# Install runtime engine requirements safely without user clashing
RUN apk add --no-cache libc6-compat openssl

# Transfer ownership directly to the default 'node' user (ID 1000)
COPY --from=prod-deps --chown=node:node /usr/src/app/package.json ./package.json
COPY --from=prod-deps --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --from=build --chown=node:node /usr/src/app/prisma ./prisma
COPY --from=build --chown=node:node /usr/src/app/prisma.config.ts ./prisma.config.ts

# Switch container execution context to the node user
USER node

# Expose port 7860 for Hugging Face
EXPOSE 7860

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]