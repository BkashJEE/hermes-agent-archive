#!/usr/bin/env node
/**
 * Render assets/social-preview.png from the archive's real figures.
 *
 * The card states how many entries and credited people the archive holds, so it
 * has to be regenerated rather than hand-maintained — a social card showing a
 * number the site no longer has is the same failure as inventing one.
 *
 * Needs chromium on PATH (for the real Poppins/Lora, which are not installed
 * locally and would otherwise be substituted).
 *
 *   node scripts/make-og.mjs
 */

import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/social-preview.png');

const read = async f => JSON.parse(await readFile(join(ROOT, 'data', f), 'utf8'));
const cfg = await read('index.json');
const live = await read('live.json').catch(() => ({}));
const routed = live.routed || {};

let entries = 0;
const sources = new Set(), authors = new Set();
for (const s of cfg.sections) {
  if (!s.file) continue;
  const items = [...(await read(s.file)).items, ...(routed[s.id] || [])];
  entries += items.length;
  for (const i of items) { if (i.source) sources.add(i.source); if (i.author) authors.add(i.author); }
}

const stat = (v, k) => `<div><div class="s-v">${v.toLocaleString()}</div><div class="s-k">${k}</div></div>`;
const html = (await readFile(join(ROOT, 'assets/og-template.html'), 'utf8'))
  .replace('<!--STATS-->', [
    stat(entries, 'entries'),
    stat(authors.size, 'people credited'),
    stat(sources.size, 'sources')
  ].join(''));

const dir = await mkdtemp(join(tmpdir(), 'og-'));
const page = join(dir, 'og.html');
await writeFile(page, html);

try {
  await run('chromium', ['--headless=new', '--disable-gpu', '--hide-scrollbars',
                         '--window-size=1200,630', `--screenshot=${OUT}`, `file://${page}`]);
} catch (err) {
  console.error('chromium could not render the card:', err.message);
  console.error('The existing assets/social-preview.png is left untouched.');
  process.exit(1);
}

console.log(`\nWrote assets/social-preview.png — ${entries.toLocaleString()} entries · ${authors.size} credited · ${sources.size} sources\n`);
