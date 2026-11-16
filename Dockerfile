# syntax=docker/dockerfile:1
#
# Image de production d'Anta (staging + production, Epic 8).
# Node 24 : aligné sur `engines.node` (>=24), `.nvmrc` et la CI.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app

# --- Build : devDependencies (assembler, tsc, vite) + `node ace build` ---
FROM base AS build
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN node ace build

# --- Runtime : uniquement build/ + dépendances de production ---
# Pas de `.npmrc` ici : son `include=dev` l'emporterait sur `--omit=dev`.
FROM base AS runtime
# Commit de l'image (passé par la CI), renvoyé par GET /health.
ARG GIT_SHA=unknown
ENV ANTA_REVISION=$GIT_SHA \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    TZ=UTC
RUN chown node:node /app
USER node
COPY --from=build --chown=node:node /app/build ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

EXPOSE 3333
# Migrations depuis build/ (JS compilé), puis le serveur remplace le shell (signaux reçus par Node).
CMD ["sh", "-c", "node ace migration:run --force && exec node bin/server.js"]
