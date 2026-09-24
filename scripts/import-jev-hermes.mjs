#!/usr/bin/env node
/**
 * Import the Hermes-related entries from the independent Jev builder directory.
 *
 *   https://www.jev-use-cases.com
 *
 * The directory renders 18 tiles and paginates, but ships its whole dataset in the
 * Next.js flight payload, so one fetch gets everything. We keep only entries that
 * actually mention Hermes — this archive stores Hermes Agent material and nothing else.
 *
 * X impressions are the directory's own published figures, carried over as-is and
 * credited to it. We do not measure impressions ourselves and never estimate them.
 *
 *   node scripts/import-jev-hermes.mjs
 */

import './env.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://www.jev-use-cases.com/';

const res = await fetch(SRC, { headers: { 'user-agent': 'hermes-agent-archive/1.0' }, signal: AbortSignal.timeout(30000) });
if (!res.ok) throw new Error(`${SRC} — ${res.status} ${res.statusText}`);
const html = await res.text();

/* The payload is JSON escaped inside script chunks; unescape, then take each record. */
const flat = html.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
const blocks = flat.match(/\{"id":"[0-9a-f-]{36}",.*?"preview":(?:null|\{.*?\})\}/g) || [];
if (blocks.length < 100) throw new Error(`Found only ${blocks.length} records — the payload shape changed; fix the parser rather than importing a fraction.`);

const all = [];
let unparsed = 0;
for (const b of blocks) {
  try { all.push(JSON.parse(b)); } catch { unparsed++; }
}

const HERMES = /\bhermes\b/i;
const hermes = all.filter(r => HERMES.test(`${r.title} ${r.description} ${r.category}`));

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

const items = hermes.map(r => ({
  id: `jev-${r.slug || slug(r.title)}`,
  title: r.title,
  summary: r.description,
  detail: `${r.description}\n\nPosted by @${r.author}${r.published_at ? ` on ${r.published_at.slice(0, 10)}` : ''}. Listed under ${r.category} in the independent Jev builder directory, which reports ${r.x_impressions?.toLocaleString() ?? 'no'} X impressions for the original post.`,
  tags: ['jev-directory', slug(r.category || 'general')],
  source: 'x',
  url: r.source_url,
  author: `@${r.author}`,
  date: (r.published_at || '').slice(0, 10) || undefined,
  metric: Number.isFinite(r.x_impressions) ? { kind: 'impressions', value: r.x_impressions } : undefined,
  metric2: Number.isFinite(r.votes) && r.votes > 0 ? { kind: 'votes', value: r.votes } : undefined,
  credit: 'jev-use-cases.com'
}));

/* Merge into builds beside the GitHub projects, replacing any earlier import. */
const path = join(ROOT, 'data/builds.json');
const builds = JSON.parse(await readFile(path, 'utf8'));
const kept = builds.items.filter(i => !String(i.id).startsWith('jev-'));
builds.items = [...kept, ...items];
builds.jevImportedAt = new Date().toISOString();
await writeFile(path, JSON.stringify(builds, null, 2) + '\n');

console.log(`\nScanned ${all.length} directory entries${unparsed ? ` (${unparsed} unparseable)` : ''}.`);
console.log(`${items.length} mention Hermes and were imported:\n`);
for (const i of items) console.log(`  ${(i.metric?.value ?? 0).toLocaleString().padStart(9)} impressions  ${i.title}  ${i.author}`);
console.log(`\nThe other ${all.length - items.length} are not Hermes-related and were left out.`);
