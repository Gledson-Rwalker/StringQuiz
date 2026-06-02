# Estágio de Build
FROM node:20-slim AS builder
WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y openssl

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/
COPY mini-services/quiz-service/package*.json ./mini-services/quiz-service/

# Instalar todas as dependências
RUN npm install
RUN cd mini-services/quiz-service && npm install

# Copiar o resto do código
COPY . .

# Gerar o cliente do Prisma e fazer o build do Next.js
RUN npx prisma generate
RUN npm run build

# Estágio de Produção
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl
ENV NODE_ENV=production

# Copiar arquivos necessários do builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/mini-services ./mini-services
COPY --from=builder /app/node_modules ./node_modules

# Expor as portas
EXPOSE 3000
EXPOSE 3003

# Script para rodar os dois serviços simultaneamente
CMD npx prisma db push && \
    (node mini-services/quiz-service/index.ts & node server.js)