#!/usr/bin/env node
/**
 * Import the owner's own Hermes posts from the portfolio.
 *
 *   ~/bkashjee.github.io/src/content/mostViewed.ts
 *
 * That file is already the curated set: each entry carries the post's own words,
 * its permalink, and impression and engagement counts taken from the owner's X
 * analytics exports. Nothing here is rewritten or re-measured — the figures are
 * carried over as published and credited to those exports on the card.
 *
 * Only `hermes` and `jev-hermes` entries are taken. The archive stores Hermes
 * Agent material; posts about other subjects stay on the portfolio.
 *
 *   node scripts/import-my-posts.mjs [path-to-portfolio]
 */

import './env.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || join(homedir(), 'bkashjee.github.io', 'src/content/mostViewed.ts');
const KEEP = new Set(['hermes', 'jev-hermes']);

let raw;
try {
  raw = await readFile(SRC, 'utf8');
} catch {
  console.log(`No portfolio at ${SRC} — nothing imported, existing entries untouched.`);
  process.exit(0);
}

/* The source is a TypeScript module, so read the object literals directly
   rather than pulling in a parser. Fail loudly if the shape changes. */
const blocks = [...raw.matchAll(/\{\s*id:\s*'([^']+)'([\s\S]*?)\n  \},/g)];
if (blocks.length < 5) throw new Error(`Parsed only ${blocks.length} entries — mostViewed.ts changed shape; fix the parser rather than importing a fraction.`);

const field = (b, name) => {
  const m = b.match(new RegExp(`${name}:\\s*\\n?\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  return m ? m[1].replace(/\\'/g, "'").replace(/\\n/g, ' ').trim() : undefined;
};
const number = (b, name) => {
  const m = b.match(new RegExp(`${name}:\\s*(\\d+)`));
  return m ? Number(m[1]) : undefined;
};

const items = [];
let skipped = 0;
for (const [, id, body] of blocks) {
  const tab = field(body, 'tab');
  if (!KEEP.has(tab)) { skipped++; continue; }

  const impressions = number(body, 'impressions');
  const engagement = ['likes', 'bookmarks', 'reposts'].reduce((n, k) => n + (number(body, k) || 0), 0);
  const postText = field(body, 'postText');
  const summary = field(body, 'summary') || '';
  const repo = field(body, 'repoUrl');

  items.push({
    id: `mine-${id}`,
    title: field(body, 'title') || id,
    summary,
    detail: [
      postText ? `“${postText}”` : null,
      summary,
      repo ? `Repository: ${repo}` : null,
      'Posted by the archive’s author. Impression and engagement counts come from their own X analytics exports, carried over as published.'
    ].filter(Boolean).join('\n\n'),
    tags: ['my-work', tab === 'jev-hermes' ? 'jev' : 'hermes'],
    source: 'x',
    url: field(body, 'postUrl'),
    author: '@BkashJosi',
    date: field(body, 'date'),
    metric: Number.isFinite(impressions) ? { kind: 'impressions', value: impressions } : undefined,
    metric2: engagement > 0 ? { kind: 'engagements', value: engagement } : undefined,
    repo: repo?.replace('https://github.com/', '') || undefined,
    credit: 'author’s own X analytics exports'
  });
}

items.sort((a, b) => (b.metric?.value ?? 0) - (a.metric?.value ?? 0));

/* Additive, like every other importer: an entry already here is refreshed, never removed. */
const target = join(ROOT, 'data/my-work.json');
const existing = JSON.parse(await readFile(target, 'utf8').catch(() => '{"items":[]}')).items || [];
const byId = new Map(existing.map(i => [i.id, i]));
let added = 0;
for (const it of items) {
  if (byId.has(it.id)) byId.set(it.id, { ...byId.get(it.id), ...it });
  else { byId.set(it.id, it); added++; }
}

await writeFile(target, JSON.stringify({
  note: `Imported from ${SRC} by scripts/import-my-posts.mjs. These are the archive author's own posts. Impression and engagement figures come from their X analytics exports and are carried over as published, not measured here.`,
  importedAt: new Date().toISOString(),
  items: [...byId.values()]
}, null, 2) + '\n');

console.log(`\n${items.length} of the author's Hermes posts imported (${added} new, ${skipped} on other subjects left out).\n`);
for (const i of items) console.log(`  ${(i.metric?.value ?? 0).toLocaleString().padStart(8)} impressions  ${i.title.slice(0, 58)}`);
