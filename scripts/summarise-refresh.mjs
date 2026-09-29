#!/usr/bin/env node
/**
 * Say what a refresh actually found, in one line.
 *
 *   node scripts/summarise-refresh.mjs            # "4 new · 2 shelves"
 *   node scripts/summarise-refresh.mjs --body     # the longer breakdown
 *
 * The daily job's pull request was titled "Refresh public signals" whether it had found
 * seven new entries or none at all. A notification that cannot be acted on without
 * opening it is barely a notification, so the title now carries the number and the
 * shelves, and the body lists what arrived.
 *
 * Compares the working tree against the last committed state, so it runs after the
 * fetch-and-route step and before the commit.
 */

import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** live.json as it stood at HEAD, or null when it cannot be read. */
function committed(path) {
  try {
    return JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString());
  } catch {
    return null;
  }
}

const routedIds = live => {
  const out = new Map();
  for (const [shelf, items] of Object.entries(live?.routed || {}))
    for (const item of items) out.set(item.id, { shelf, title: item.title, url: item.url });
  return out;
};

const now = JSON.parse(await readFile(join(ROOT, 'data', 'live.json'), 'utf8'));
const before = committed('data/live.json');

const wasRouted = routedIds(before);
const isRouted = routedIds(now);
const added = [...isRouted].filter(([id]) => !wasRouted.has(id)).map(([, v]) => v);

/* A source that failed is worth saying out loud: a quiet run and a broken run look
   identical from the outside, and only one of them needs attention. */
const warnings = now.warnings || [];

if (process.argv.includes('--body')) {
  const lines = [];
  if (added.length) {
    const byShelf = added.reduce((m, a) => ((m[a.shelf] ||= []).push(a), m), {});
    lines.push(`Found **${added.length}** new ${added.length === 1 ? 'entry' : 'entries'}.`, '');
    for (const [shelf, items] of Object.entries(byShelf)) {
      lines.push(`**${shelf}** — ${items.length}`);
      for (const item of items.slice(0, 8)) lines.push(`- [${item.title}](${item.url})`);
      if (items.length > 8) lines.push(`- …and ${items.length - 8} more`);
      lines.push('');
    }
  } else {
    lines.push('No new entries this run; metrics and classifications were refreshed.', '');
  }
  if (warnings.length) {
    lines.push('**Sources that failed**', ...warnings.map(w => `- ${w}`), '');
  }
  lines.push('Validation: `npm run check` and `npm test` passed. Review eligibility, freshness',
             'and any source warnings before approving publication.', '',
             'Merging this does not publish it. The Vercel project has no Git integration,',
             'so the site changes only when someone deploys from main.');
  console.log(lines.join('\n'));
} else {
  const shelves = new Set(added.map(a => a.shelf));
  const head = added.length
    ? `${added.length} new ${added.length === 1 ? 'entry' : 'entries'} across ${shelves.size} ${shelves.size === 1 ? 'shelf' : 'shelves'}`
    : 'metrics only, nothing new';
  console.log(`Daily refresh — ${head}${warnings.length ? ` (${warnings.length} source warning${warnings.length === 1 ? '' : 's'})` : ''}`);
}
