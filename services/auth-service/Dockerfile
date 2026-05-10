FROM node:20-alpine AS builder
WORKDIR /app

# Copy the shared observability package (compiled dist + manifest only).
COPY packages/observability/package.json ./obs/package.json
COPY packages/observability/dist        ./obs/dist

COPY services/auth-service/package.json ./package.json
RUN npm install
COPY services/auth-service/prisma ./prisma
RUN npx prisma generate
COPY services/auth-service/tsconfig.json ./
COPY services/auth-service/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Required by Prisma engine on Alpine (OpenSSL 3)
RUN apk add --no-cache openssl

COPY packages/observability/package.json ./obs/package.json
COPY packages/observability/dist        ./obs/dist

COPY services/auth-service/package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY services/auth-service/prisma ./prisma
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node --require @games-platform/observability/tracing dist/app.js"]
