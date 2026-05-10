FROM node:20-alpine AS builder
WORKDIR /app

COPY packages/observability/package.json ./obs/package.json
COPY packages/observability/dist        ./obs/dist

COPY services/guess-number-service/package.json ./package.json
RUN npm install
COPY services/guess-number-service/tsconfig.json ./
COPY services/guess-number-service/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY packages/observability/package.json ./obs/package.json
COPY packages/observability/dist        ./obs/dist

COPY services/guess-number-service/package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3004
CMD ["node", "--require", "@games-platform/observability/tracing", "dist/app.js"]
