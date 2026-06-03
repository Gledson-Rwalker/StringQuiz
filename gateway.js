/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({
  proxyTimeout: 30000, // 30 segundos de timeout
  timeout: 30000
});

const NEXT_APP = 'http://127.0.0.1:3001'; 
const QUIZ_SERVICE = 'http://127.0.0.1:3003';

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/socket.io') || req.url.startsWith('/api/socket.io')) {
    proxy.web(req, res, { target: QUIZ_SERVICE }, (e) => {
      res.writeHead(503);
      res.end('Serviço de Quiz carregando...');
    });
  } else {
    proxy.web(req, res, { target: NEXT_APP }, (e) => {
      res.writeHead(503);
      res.end('Sistema principal carregando... Aguarde 1 minuto e atualize a página.');
    });
  }
});

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/socket.io') || req.url.startsWith('/api/socket.io')) {
    proxy.ws(req, socket, head, { target: QUIZ_SERVICE });
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Gateway ativo na porta ${PORT}. Aguardando serviços internos...`);
});