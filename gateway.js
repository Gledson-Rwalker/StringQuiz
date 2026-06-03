/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});
const NEXT_APP = 'http://localhost:3000';
const QUIZ_SERVICE = 'http://localhost:3003';

const server = http.createServer((req, res) => {
  // Se a URL começar com /socket.io ou /api/socket.io, manda para o serviço de Quiz
  if (req.url.startsWith('/socket.io') || req.url.startsWith('/api/socket.io')) {
    proxy.web(req, res, { target: QUIZ_SERVICE }, (e) => {
      console.error('Erro no Proxy (Quiz):', e.message);
    });
  } else {
    // Todo o resto vai para o Next.js
    proxy.web(req, res, { target: NEXT_APP }, (e) => {
      // Silencia erros de conexão inicial do Next.js durante o boot
      if (res.writableEnded) return;
      res.writeHead(502);
      res.end('Next.js ainda carregando...');
    });
  }
});

// Suporte a WebSockets (essencial para o Quiz)
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/socket.io') || req.url.startsWith('/api/socket.io')) {
    proxy.ws(req, socket, head, { target: QUIZ_SERVICE });
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway rodando na porta ${PORT}`);
});