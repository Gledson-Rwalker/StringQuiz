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
RUN npm install -g tsx 

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/mini-services ./mini-services
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/gateway.js ./gateway.js

EXPOSE 10000

# O segredo está aqui: PORT=3001 node server.js
CMD for i in {1..5}; do npx prisma db push --accept-data-loss && break || sleep 5; done && \
    (tsx mini-services/quiz-service/index.ts & \
     PORT=3001 node server.js & \
     node gateway.js)