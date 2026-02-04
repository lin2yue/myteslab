FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy full repo for monorepo build
COPY . .

# Install dependencies and build only web-cn
RUN pnpm --filter web-cn... install
RUN pnpm --filter web-cn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

COPY --from=builder /app/apps/web-cn/.next apps/web-cn/.next
COPY --from=builder /app/apps/web-cn/public apps/web-cn/public
COPY --from=builder /app/apps/web-cn/package.json apps/web-cn/package.json
COPY --from=builder /app/node_modules /app/node_modules

WORKDIR /app/apps/web-cn
EXPOSE 3000

CMD ["pnpm", "start"]
