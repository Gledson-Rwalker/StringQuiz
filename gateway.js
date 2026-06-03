/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});
// Portas internas fixas para evitar conflito com a porta do Render
const NEXT_APP = 'http://localhost:3001'; 
const QUIZ_SERVICE = 'http://localhost:3003';

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/socket.io') || req.url.startsWith('/api/socket.io')) {
    proxy.web(req, res, { target: QUIZ_SERVICE }, (e) => {
      console.error('Erro no Proxy (Quiz):', e.message);
    });
  } else {
    proxy.web(req, res, { target: NEXT_APP }, (e) => {
      if (!res.writableEnded) {
        res.writeHead(502);
        res.end('Aguardando inicialização do sistema...');
      }
    });
  }
});

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/socket.io') || req.url.startsWith('/api/socket.io')) {
    proxy.ws(req, socket, head, { target: QUIZ_SERVICE });
  }
});

// O Gateway escuta na porta que o Render mandar (10000)
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Gateway Principal rodando na porta ${PORT}`);
});