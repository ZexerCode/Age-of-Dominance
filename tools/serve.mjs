// Basit yerel sunucu: npm start → http://localhost:8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Bulunamadı'); return; }
    const type = types[path.extname(file)] || 'application/octet-stream';
    const gz = /gzip/.test(req.headers['accept-encoding'] || '') && /json|javascript|css|html/.test(type);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache', ...(gz ? { 'content-encoding': 'gzip' } : { 'content-length': data.length }) });
    res.end(gz ? zlib.gzipSync(data) : data);
  });
}).listen(port, () => console.log(`Age of Dominance: http://localhost:${port}`));
