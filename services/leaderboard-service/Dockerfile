FROM node:20-alpine AS builder
WORKDIR /app

COPY packages/observability/package.json ./obs/package.json
COPY packages/observability/dist        ./obs/dist

COPY services/leaderboard-service/package.json ./package.json
RUN npm install
COPY services/leaderboard-service/prisma ./prisma
RUN npx prisma generate
COPY services/leaderboard-service/tsconfig.json ./
COPY services/leaderboard-service/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY packages/observability/package.json ./obs/package.json
COPY packages/observability/dist        ./obs/dist

COPY services/leaderboard-service/package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY services/leaderboard-service/prisma ./prisma
EXPOSE 3002
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node --require @games-platform/observability/tracing dist/app.js"]
