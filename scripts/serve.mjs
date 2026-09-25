#!/usr/bin/env node
/**
 * Development server for the archive. Zero dependencies.
 *
 * Exists for one reason: `python3 -m http.server` sends no cache headers, so
 * browsers apply heuristic caching to ES modules and keep serving a stale
 * app.js or icons.js after an edit. That produced several false verifications —
 * the page under review was not the code on disk. Everything here is sent
 * `Cache-Control: no-store`, so what you reload is what you wrote.
 *
 *   node scripts/serve.mjs [port]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4179);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';

    // Never serve outside the project, whatever the request says.
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end('Not found'); return; }

    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'content-length': info.size,
      'cache-control': 'no-store, must-revalidate',
      pragma: 'no-cache'
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end('Not found');
  }
}).listen(PORT, () => {
  console.log(`\n  Hermes Agent Archive  →  http://localhost:${PORT}/`);
  console.log(`  Nothing is cached; a reload always shows the code on disk.\n`);
});
