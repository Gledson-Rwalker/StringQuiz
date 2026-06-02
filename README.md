# QuizCorp - Plataforma Corporativa de Quiz

Um clone do Kahoot corporativo construído com Next.js 16, TypeScript, Prisma e WebSocket (Socket.IO).

## Funcionalidades

- **Criar e gerenciar quizzes** com perguntas de múltipla escolha ou resposta numérica
- **Sala de espera com PIN** para jogadores entrarem
- **Sistema "PRONTO!"** - jogadores clicam PRONTO! antes de cada pergunta; quando todos estão prontos, a pergunta é lançada automaticamente
- **Perguntas de múltipla escolha** (4 opções, estilo Kahoot)
- **Perguntas numéricas** com pontuação por proximidade + bônus de velocidade
- **Timer circular** animado com cores dinâmicas
- **Ranking em tempo real** com pontuação por velocidade
- **Interface responsiva** com animações (Framer Motion)

## Stack Tecnológica

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Next.js API Routes + Prisma ORM (SQLite)
- **Tempo Real**: Socket.IO (servidor separado)
- **Estado**: Zustand
- **Animações**: Framer Motion

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18+ ou [Bun](https://bun.sh/) 1+
- npm, yarn, pnpm ou bun

## Instalação

### 1. Clone o repositório (ou extraia o ZIP)

```bash
cd quizcorp
```

### 2. Instale as dependências

```bash
npm install
# ou
bun install
```

### 3. Configure o banco de dados

Copie o arquivo de exemplo de variáveis de ambiente:

```bash
cp .env.example .env
```

Execute as migrações do Prisma:

```bash
npx prisma db push
# ou
bun run db:push
```

### 4. Instale as dependências do serviço WebSocket

```bash
cd mini-services/quiz-service
npm install
# ou
bun install
cd ../..
```

### 5. Inicie os servidores

**Terminal 1 - WebSocket Server:**
```bash
cd mini-services/quiz-service
npm start
# ou
bun run index.ts
```
O servidor WebSocket vai rodar na porta 3003.

**Terminal 2 - Next.js App:**
```bash
npm run dev
# ou
bun run dev
```
O app Next.js vai rodar na porta 3000.

### 6. Acesse no navegador

Abra [http://localhost:3000](http://localhost:3000)

## Como Usar

### Como Host (Apresentador)

1. Acesse a aplicação no navegador
2. Clique em **"Criar Novo Quiz"** ou use **"Carregar Dados de Exemplo"**
3. Configure suas perguntas (múltipla escolha ou numérica)
4. Clique em **"Iniciar"** no quiz desejado
5. Compartilhe o **PIN de 6 dígitos** com os jogadores
6. Aguarde os jogadores entrarem e clique **"Iniciar Jogo"**
7. Clique no botão de enviar pergunta - os jogadores verão o botão **"PRONTO!"**
8. Quando todos clicarem PRONTO!, a pergunta inicia automaticamente
9. Ou clique **"Iniciar Mesmo Assim"** para forçar o início

### Como Jogador

1. Acesse a aplicação no navegador (pode ser em outro dispositivo)
2. Clique em **"Entrar em um Quiz"**
3. Digite o PIN fornecido pelo host
4. Digite seu nome e entre na sala
5. Quando o host iniciar, clique **"PRONTO!"** quando aparecer
6. Responda as perguntas o mais rápido possível!

## Estrutura do Projeto

```
quizcorp/
├── prisma/
│   └── schema.prisma          # Schema do banco de dados (SQLite)
├── src/
│   ├── app/
│   │   ├── api/               # API Routes (Next.js)
│   │   │   ├── quizzes/       # CRUD de quizzes
│   │   │   ├── sessions/      # Sessões de jogo
│   │   │   └── seed/          # Dados de exemplo
│   │   ├── globals.css        # Estilos globais
│   │   ├── layout.tsx         # Layout principal
│   │   └── page.tsx           # Página principal (todos os views)
│   ├── components/ui/         # Componentes shadcn/ui
│   ├── hooks/                 # Custom hooks
│   └── lib/
│       ├── db.ts              # Prisma client
│       ├── store.ts           # Zustand store
│       └── utils.ts           # Utilitários
├── mini-services/
│   └── quiz-service/
│       ├── index.ts           # Servidor WebSocket (Socket.IO)
│       └── package.json       # Dependências do WS server
├── public/                    # Arquivos estáticos
├── .env.example               # Variáveis de ambiente
├── package.json               # Dependências principais
├── next.config.ts             # Configuração do Next.js
├── tailwind.config.ts         # Configuração do Tailwind
└── tsconfig.json              # Configuração do TypeScript
```

## Modos de Pergunta

### Múltipla Escolha
- 4 opções com cores distintas (vermelho, azul, amarelo, verde)
- Pontuação: 1000 pontos base + até 500 de bônus de velocidade
- Máximo: 1500 pontos por pergunta

### Resposta Numérica
- Jogador digita um número
- Pontuação por proximidade: quanto mais perto da resposta correta, mais pontos
- Bônus de velocidade aplicado proporcionalmente à proximidade
- Resposta exata: 1000 pontos + bônus de velocidade completo
- Máximo: 1500 pontos por pergunta

## Personalização

### Variáveis de Ambiente (.env)

```env
# Caminho do banco de dados SQLite
DATABASE_URL=file:./dev.db

# Porta do servidor WebSocket (padrão: 3003)
WS_PORT=3003
```

### Dados de Exemplo

Para carregar quizzes de demonstração, acesse:
```
http://localhost:3000/api/seed
```
Ou clique em **"Carregar Dados de Exemplo"** no dashboard.

## Solução de Problemas

### WebSocket não conecta
- Verifique se o servidor WebSocket está rodando na porta 3003
- Se usar proxy/reverse proxy, configure o WebSocket corretamente

### Banco de dados não funciona
- Execute `npx prisma db push` para criar/atualizar o banco
- Verifique se o caminho no `.env` está correto

### Erro ao instalar dependências
- Delete `node_modules` e `bun.lock`/`package-lock.json`
- Execute `npm install` ou `bun install` novamente

## Licença

Este projeto é para uso interno corporativo.
