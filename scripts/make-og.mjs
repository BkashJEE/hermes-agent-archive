#!/usr/bin/env node
/**
 * Render assets/social-preview.png from the archive's real figures.
 *
 * The card states how many entries and credited people the archive holds, so it
 * has to be regenerated rather than hand-maintained — a social card showing a
 * number the site no longer has is the same failure as inventing one.
 *
 * Needs chromium on PATH (for the approved Inter/JetBrains Mono, which are not installed
 * locally and would otherwise be substituted).
 *
 *   node scripts/make-og.mjs
 */

import { mergeLive } from '../assets/js/archive.js';
import { creditFor } from '../assets/js/credits.js';
import { readFile, writeFile, mkdtemp, rename } from 'node:fs/promises';
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
const live = await read('live.json');
const data = {};
for (const section of cfg.sections) {
  if (!section.file) continue;
  data[section.id] = (await read(section.file)).items;
}
mergeLive(data, live);
const items = Object.values(data).flat();
const entries = items.length;
const sources = new Set(items.map(i => i.source));
const authors = new Set(items.map(creditFor).filter(c => c.label !== 'Author').map(c => c.name));

const stat = (v, k) => `<div><div class="s-v">${v.toLocaleString()}</div><div class="s-k">${k}</div></div>`;
const html = (await readFile(join(ROOT, 'assets/og-template.html'), 'utf8'))
  .replace('<!--TOKENS-->', (await readFile(join(ROOT, 'assets/css/style.css'), 'utf8')).match(/:root\s*\{[\s\S]*?\}/)[0])
  .replace('<!--STATS-->', [
    stat(entries, 'entries'),
    stat(authors.size, 'people credited'),
    stat(sources.size, 'sources')
  ].join(''));

const dir = await mkdtemp(join(tmpdir(), 'og-'));
const page = join(dir, 'og.html');
await writeFile(page, html);
if (process.argv.includes('--html-only')) { console.log(page); process.exit(0); }
const rendered = join(dir, 'social-preview.png');

try {
  await run('chromium', ['--headless=new', '--disable-gpu', '--hide-scrollbars',
                         '--window-size=1200,630', `--screenshot=${rendered}`, `file://${page}`]);
  const png = await readFile(rendered);
  if (png.length < 1000 || png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) throw new Error('Invalid rendered PNG');
  await rename(rendered, OUT);
} catch (err) {
  console.error('chromium could not render the card:', err.message);
  console.error('The existing assets/social-preview.png is left untouched.');
  process.exit(1);
}

console.log(`\nWrote assets/social-preview.png — ${entries.toLocaleString()} entries · ${authors.size} credited · ${sources.size} sources\n`);
