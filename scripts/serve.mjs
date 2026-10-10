#!/usr/bin/env node
/** Local preview only: serve public assets without caching or exposing project files. */
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, sep } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

export async function createArchiveServer(root = ROOT) {
  root = await realpath(root);
  const cfg = JSON.parse(await readFile(resolve(root, 'data/index.json'), 'utf8'));
  const publicFiles = new Set(['index.html', 'robots.txt', 'sitemap.xml', 'data/index.json', 'data/live.json', 'data/rankings.json', 'data/added.json']);
  for (const section of cfg.sections) {
    if (!section.file) continue;
    if (!/^[a-z0-9-]+\.json$/i.test(section.file)) throw new Error('Invalid section file');
    publicFiles.add(`data/${section.file}`);
  }
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
    }
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      const segments = path.split('/');
      if (path.includes('\\') || segments.some(s => !s || s.startsWith('.'))) throw new Error('Invalid path');
      const asset = path.startsWith('assets/') && TYPES[extname(path)];
      /* The generated entry and shelf pages, matched by shape rather than listed: there
         are 938 of them and they change with the data. Vercel serves these with
         `cleanUrls`, so /entry/<id> resolves to entry/<id>.html; the same here, or local
         and production disagree about every link in the sitemap. The id pattern is the
         one build-pages.mjs enforces, and the traversal, symlink and root checks below
         still apply to whatever it produces. */
      const generated = /^(entry|shelf)\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(path)
        && !path.endsWith('.html') ? `${path}.html` : null;
      const served = generated ?? path;
      const isGenerated = /^(entry|shelf)\/[A-Za-z0-9][A-Za-z0-9._-]*\.html$/.test(served);
      if (!publicFiles.has(served) && !asset && !isGenerated) throw new Error('Not public');
      const file = resolve(root, served);
      // Reject symlinks too: a public-looking filename must not alias a secret.
      if (!file.startsWith(root + sep) || await realpath(file) !== file) throw new Error('Invalid target');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)], 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || process.env.PORT || 4179);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  (await createArchiveServer()).listen(port, '127.0.0.1', () => {
    console.log(`\n  Hermes Agent Archive → http://127.0.0.1:${port}/\n  Local only. Public assets only. No caching.\n`);
  });
}
