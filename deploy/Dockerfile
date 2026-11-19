FROM node:22-bookworm-slim AS backend
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN NODE_ENV=development npm ci --omit=optional --include=dev && npx prisma generate
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN NODE_ENV=development npm ci --include=dev
COPY frontend ./
ARG NEXT_PUBLIC_API_URL=https://app.e-kofi.com/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=backend /app/node_modules /app/backend/node_modules
COPY --from=backend /app/dist /app/backend/dist
COPY --from=backend /app/prisma /app/backend/prisma
COPY --from=backend /app/package.json /app/backend/package.json
COPY backend/prisma /app/backend/prisma

COPY --from=frontend /app/node_modules /app/frontend/node_modules
COPY --from=frontend /app/.next /app/frontend/.next
COPY --from=frontend /app/public /app/frontend/public
COPY --from=frontend /app/package.json /app/frontend/package.json
COPY --from=frontend /app/next.config.ts /app/frontend/next.config.ts

COPY host-router.mjs /app/host-router.mjs
COPY start.sh /app/start.sh
RUN sed -i 's/\r$//' /app/start.sh && chmod +x /app/start.sh

ENV NODE_ENV=production
ENV API_PORT=3001
ENV WEB_PORT=3000
ENV APP_HOST=app.e-kofi.com
EXPOSE 3001
CMD ["sh", "/app/start.sh"]
