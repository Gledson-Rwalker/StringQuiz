FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl
COPY package*.json ./
COPY prisma ./prisma/
COPY mini-services/quiz-service/package*.json ./mini-services/quiz-service/
RUN npm install
RUN cd mini-services/quiz-service && npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y openssl
ENV NODE_ENV=production
# Render usa a porta 10000 por padrão, o Next vai rodar internamente na 3000
ENV PORT=3000 

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/mini-services ./mini-services
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/gateway.js ./gateway.js

EXPOSE 10000

# Comando para rodar o Quiz Service, o Next.js e o Gateway juntos
CMD npx prisma db push && \
    (node mini-services/quiz-service/index.ts & \
     node server.js & \
     node gateway.js)