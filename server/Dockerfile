# ilmNet server — production image
# Build:  docker build -t ilmnet-server ./server
# Run:    docker run -p 3001:3001 --env-file .env -v ilmnet_uploads:/app/uploads ilmnet-server
#
# The uploads volume is REQUIRED in production: the database stores "/uploads/<file>"
# references for custom thumbnails/covers, so without a persistent volume those files
# disappear on every redeploy while the database keeps pointing at them.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm install --include=dev --ignore-scripts || npm install
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json package-lock.json* ./
# uploads live on a mounted volume; create the mountpoint with the right ownership
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Run migrations before boot (idempotent): prisma migrate deploy
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
