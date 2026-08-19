# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
# Install workspace lengkap dulu (layer cache: hanya berubah bila lockfile/deps berubah)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/platform/package.json apps/platform/package.json
RUN pnpm install --frozen-lockfile
# Baru salin source & build
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter platform build

# ---------- runtime ----------
FROM nginx:1.27-alpine
COPY apps/platform/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/platform/dist /usr/share/nginx/html
EXPOSE 80
