FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Use pnpm store to speed up / stabilize installs
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Copy root config files first for caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./

# Copy all package.json files (needed for pnpm install --filter)
# Since they are at different depths, we'll copy the whole repo but filter later
# Or just copy everything now since it's a small repo
COPY . .

# Install dependencies with increased timeout and no-frozen-lockfile
RUN pnpm config set network-timeout 300000
RUN pnpm install --no-frozen-lockfile --prefer-offline

RUN pnpm --filter web-cn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat

# Copy standalone output (self-contained server.js + minimal node_modules)
COPY --from=builder /app/apps/web-cn/.next/standalone ./
COPY --from=builder /app/apps/web-cn/.next/static /app/apps/web-cn/.next/static
COPY --from=builder /app/apps/web-cn/public /app/apps/web-cn/public

EXPOSE 3000
CMD ["node", "apps/web-cn/server.js"]
