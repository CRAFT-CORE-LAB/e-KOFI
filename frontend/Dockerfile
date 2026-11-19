FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_URL=https://api.e-kofi.com/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
