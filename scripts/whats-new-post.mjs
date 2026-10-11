#!/usr/bin/env node
/**
 * A ready-to-paste post about what arrived, for the owner to share.
 *
 *   npm run post              # the last 7 days
 *   npm run post -- --days 2  # since the last harvest
 *
 * Followers find out what changed from a post, not from a panel they have to open. Every
 * figure here is counted from data/added.json — arrival dates measured from git — and
 * every name is an entry title as stored. Nothing is estimated and nothing is generated;
 * the owner reads it, edits it, and posts it, or does not.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://hermes-agent-archive.vercel.app';

export function compose({ added, items, sections, days = 7, now = Date.now() }) {
  const since = new Date(now - days * 86_400_000).toISOString().slice(0, 10);
  const label = id => sections.find(s => s.id === id)?.label || id;
  const recent = items.filter(i => added[i.id] && added[i.id] >= since);
  if (!recent.length) return null;

  const byShelf = recent.reduce((m, i) => ((m[i.shelf] ||= []).push(i), m), {});
  const shelves = Object.entries(byShelf).sort((a, b) => b[1].length - a[1].length);
  const lines = [];
  lines.push(`${recent.length} new ${recent.length === 1 ? 'entry' : 'entries'} in the Hermes Agent Archive this ${days === 1 ? 'day' : days === 7 ? 'week' : `${days} days`}:`);
  lines.push('');
  for (const [shelf, list] of shelves.slice(0, 4)) lines.push(`• ${list.length} ${label(shelf)}`);
  lines.push('');
  /* Three titles, highest-ranked first when a ranking exists; otherwise as stored. */
  const picks = [...recent].sort((a, b) => (b.ranking?.usefulness ?? 0) - (a.ranking?.usefulness ?? 0)).slice(0, 3);
  for (const p of picks) lines.push(`→ ${p.title}`);
  lines.push('');
  lines.push(`Every one is sourced and credited. ${SITE}/whats-new`);
  return lines.join('\n');
}

async function main() {
  const arg = process.argv.indexOf('--days');
  const days = arg > -1 ? Math.max(1, Number(process.argv[arg + 1]) || 7) : 7;
  const added = JSON.parse(await readFile(join(ROOT, 'data', 'added.json'), 'utf8')).added;
  const index = JSON.parse(await readFile(join(ROOT, 'data', 'index.json'), 'utf8'));
  const rankings = JSON.parse(await readFile(join(ROOT, 'data', 'rankings.json'), 'utf8').catch(() => '{"results":{}}')).results || {};
  const items = [];
  for (const s of index.sections) {
    if (!s.file) continue;
    for (const it of JSON.parse(await readFile(join(ROOT, 'data', s.file), 'utf8')).items)
      items.push({ ...it, shelf: s.id, ranking: rankings[it.id] });
  }
  const post = compose({ added, items, sections: index.sections, days });
  console.log(post ?? `Nothing arrived in the last ${days} day${days === 1 ? '' : 's'}.`);
  if (post) console.log(`\n(${post.length} characters)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
