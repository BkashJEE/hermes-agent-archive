#!/usr/bin/env node
/**
 * Import the community user stories published by Nous Research.
 *
 *   https://hermes-agent.nousresearch.com/docs/user-stories
 *
 * Every tile on that page is a real post — X, Reddit, Hacker News, GitHub, YouTube,
 * blogs, podcasts, Discord — quoted and attributed by Nous, linking to the original.
 * This parses the server-rendered page and writes them into data/use-cases.json.
 *
 * Nothing is paraphrased or embellished: the headline, the quote, the author and the
 * link are taken as published. If the page's markup changes, this fails loudly rather
 * than importing half a shelf.
 *
 *   node scripts/import-hermes-stories.mjs
 */

import './env.mjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_SRC = 'https://hermes-agent.nousresearch.com/docs/user-stories';

/* The page's own source labels -> this archive's source ids. */
const SOURCE = {
  'X · Twitter': 'x', 'Hacker News': 'hn', 'Reddit': 'reddit', 'GitHub': 'github',
  'GitHub Gist': 'github', 'YouTube': 'youtube', 'Blog': 'blog', 'Podcast': 'podcast',
  'LinkedIn': 'linkedin', 'Product Hunt': 'producthunt', 'Discord': 'discord'
};

const decode = s => s
  .replace(/<!--\s*-->/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/\s+/g, ' ')
  .trim();

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const res = await fetch(URL_SRC, { headers: { 'user-agent': 'hermes-agent-archive/1.0' }, signal: AbortSignal.timeout(30000) });
if (!res.ok) throw new Error(`${URL_SRC} — ${res.status} ${res.statusText}`);
const html = await res.text();

/* One <a class="tile_…"> per story. Class hashes change between builds, so match the
   stable prefix rather than the exact generated name. */
const tiles = html.split(/<a class="tile_/).slice(1);
if (tiles.length < 50) throw new Error(`Parsed only ${tiles.length} tiles — the page markup changed; fix the parser rather than importing a partial shelf.`);

const seen = new Set();
const items = [];
let skipped = 0;

for (const tile of tiles) {
  const href     = tile.match(/href="([^"]+)"/)?.[1];
  const source   = tile.match(/class="sourceBadge_[^"]*">(?:<span[^>]*><\/span>)?([^<]+)</)?.[1]?.trim();
  const category = tile.match(/class="catTag_[^"]*">([^<]+)</)?.[1]?.trim();
  const headline = tile.match(/class="headline_[^"]*">([\s\S]*?)<\/h3>/)?.[1];
  const quote    = tile.match(/class="quote_[^"]*">([\s\S]*?)<\/p>/)?.[1];
  const byline   = tile.match(/class="author_[^"]*">([\s\S]*?)<\/span>/)?.[1];

  if (!href || !headline || !quote) { skipped++; continue; }

  const title = decode(headline);
  const text  = decode(quote).replace(/^[“"]\s*|\s*[”"]$/g, '');
  const who   = decode(byline || '');
  const [author, date] = who.split('·').map(s => s.trim());

  let id = `story-${slug(title)}`;
  if (seen.has(id)) id = `${id}-${seen.size}`;
  seen.add(id);

  items.push({
    id,
    title,
    summary: text.length > 180 ? text.slice(0, 177).trimEnd() + '…' : text,
    detail: `${text}\n\n— ${author || 'anonymous'}${date ? `, ${date}` : ''}, via ${source || 'the Hermes Agent user stories'}.`,
    tags: ['user-story', slug(decode(category || 'general'))],
    source: SOURCE[source] || 'community',
    url: href,
    author: author || undefined,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : undefined
  });
}

const payload = {
  note: `Imported from ${URL_SRC} by scripts/import-hermes-stories.mjs. Every entry is a real post quoted and attributed on that page; the headline, quote, author and link are as published. Re-run to refresh.`,
  importedAt: new Date().toISOString(),
  items
};

await writeFile(join(ROOT, 'data/use-cases.json'), JSON.stringify(payload, null, 2) + '\n');

const byCat = items.reduce((m, i) => (m[i.tags[1]] = (m[i.tags[1]] || 0) + 1, m), {});
const bySrc = items.reduce((m, i) => (m[i.source] = (m[i.source] || 0) + 1, m), {});
console.log(`\nImported ${items.length} stories${skipped ? `, skipped ${skipped} unparseable` : ''}.\n`);
console.log('by category:'); for (const [k, v] of Object.entries(byCat).sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);
console.log('\nby source:');  for (const [k, v] of Object.entries(bySrc).sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);
