import http from 'node:http';

const listenPort = Number(process.env.PORT || 8080);
const apiPort = Number(process.env.API_PORT || 3001);
const webPort = Number(process.env.WEB_PORT || 3000);
const appHost = (process.env.APP_HOST || 'app.e-kofi.com').toLowerCase();

function hostname(req) {
  const raw = req.headers.host || req.headers['x-forwarded-host'] || '';
  return String(raw)
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

function targetPort(req) {
  if (hostname(req) !== appHost) return apiPort;
  const path = req.url || '/';
  if (path === '/api' || path.startsWith('/api/') || path.startsWith('/api?')) return apiPort;
  return webPort;
}

function proxy(req, res) {
  const port = targetPort(req);
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain' });
    }
    res.end('upstream unavailable');
  });
  req.pipe(upstream);
}

const server = http.createServer(proxy);
server.on('upgrade', (req, socket, head) => {
  const port = targetPort(req);
  const upstream = http.request({
    hostname: '127.0.0.1',
    port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });
  upstream.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
    const headers = [`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}`];
    for (const [key, value] of Object.entries(upstreamRes.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.push(`${key}: ${item}`);
      } else if (value != null) {
        headers.push(`${key}: ${value}`);
      }
    }
    socket.write(`${headers.join('\r\n')}\r\n\r\n`);
    if (upstreamHead?.length) socket.write(upstreamHead);
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });
  upstream.on('error', () => socket.destroy());
  upstream.end(head);
});

server.listen(listenPort, '0.0.0.0', () => {
  console.log(`e-KOFI router listening on ${listenPort} (app host ${appHost})`);
});
