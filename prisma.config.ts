import { defineConfig } from '@prisma/config'

// @ts-ignore - Ignorando o erro de tipagem temporário da versão do Prisma
export default defineConfig({
  earlyAccess: true,
  migrate: {
    databaseUrl: process.env.DATABASE_URL,
  }
} as any)