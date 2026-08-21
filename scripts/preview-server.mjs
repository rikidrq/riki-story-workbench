import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.RIKI_PREVIEW_PORT || 8178);
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
]);

function safeFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const relative = clean === '/' ? 'preview/index.html'
    : clean === '/preview' ? 'preview/index.html'
      : clean.startsWith('/preview/') ? clean.slice(1)
        : clean.startsWith('/releases/') ? `dist${clean}`
          : '';
  if (!relative) return null;
  const target = path.resolve(root, relative);
  const prefix = `${root}${path.sep}`.toLowerCase();
  return target.toLowerCase().startsWith(prefix) ? target : null;
}

const server = http.createServer((request, response) => {
  const target = safeFile(request.url || '/');
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': mime.get(path.extname(target)) || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, max-age=0',
  });
  fs.createReadStream(target).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Riki preview: http://127.0.0.1:${port}/preview`);
  console.log(`Release base: http://127.0.0.1:${port}/releases`);
});
