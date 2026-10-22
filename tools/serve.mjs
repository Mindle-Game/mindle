// A tiny local web server for trying Mindle on your own computer. No dependencies.
// Run:  node tools/serve.mjs     then open http://127.0.0.1:8080
//
// Why not `python3 -m http.server`? That one lets the browser keep old copies of
// files, so after editing data.json a normal refresh can still show the old version.
// This server sends "Cache-Control: no-cache", which tells the browser to check
// for a newer copy every time.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';

// The browser needs to be told what kind of file it is getting.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  let file = path.join(ROOT, decodeURIComponent(pathname));
  // Only serve files inside the mindle folder, and never hidden ones like .git.
  const inside = file === ROOT || file.startsWith(ROOT + path.sep);
  const hidden = path.relative(ROOT, file).split(path.sep).some((part) => part.startsWith('.'));
  if (!inside || hidden) return notFound(res);

  try {
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    notFound(res);
  }
});

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

server.listen(PORT, HOST, () => {
  console.log(`Mindle is running at http://${HOST}:${PORT}  (press Ctrl+C to stop)`);
});
