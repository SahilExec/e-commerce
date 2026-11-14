FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL="postgresql://postgres:postgres@postgres:5432/e-commerce"
RUN npx prisma generate

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]