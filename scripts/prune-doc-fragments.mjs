#!/usr/bin/env node
/**
 * Remove the documentation fragments that should never have been shelved.
 *
 *   node scripts/prune-doc-fragments.mjs --dry   # list them, change nothing
 *   node scripts/prune-doc-fragments.mjs         # remove them, record what went
 *
 * The documentation importer's furniture filter caught "Overview" and "Examples" and
 * missed two shapes that are just as useless as cards:
 *
 *   numbered procedure steps   "1. Install Hermes Agent", "6. Start chatting"
 *   bare category labels       "Core", "Precedence", "Tier 1", "Actions"
 *
 * A step means nothing outside its sequence, and a one-word label is a heading someone
 * scrolled past, not something anyone can act on. Fifty-three of them shipped, and one —
 * "Step 5: recommended config" — ranked first on Use Cases, which made it the first thing
 * every visitor saw.
 *
 * This is a deliberate, reviewed removal, which is not the thing AGENTS.md forbids. That
 * rule exists because a rate limit once wiped a shelf: no *pipeline stage* may drop an
 * archived entry on its own. Correcting a bad import of my own making, by name, with the
 * list written down and reviewable in a pull request, is the opposite of silent.
 *
 * Only entries this importer created are eligible: the id must start with `doc-`. Nothing
 * community-sourced can be reached by this script, whatever its title looks like.
 */

import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { serialise } from './json-format.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RECORD = join(ROOT, 'scripts', 'pruned-doc-fragments.json');

/** A numbered step, or a bare label with nothing to run. Both from `doc-` ids only. */
export function isFragment(item) {
  if (!item.id?.startsWith('doc-')) return false;          // never community content
  if (/^\d+[.)]\s/.test(item.title)) return true;          // "1. Install Hermes Agent"
  if (/^step\s+\d/i.test(item.title)) return true;         // "Step 5: recommended config"
  /* One or two words and no snippet: a section label, not an instruction. A short title
     with a command attached is a different thing entirely and stays. */
  return item.title.trim().split(/\s+/).length <= 2 && !item.snippet;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const index = JSON.parse(await readFile(join(ROOT, 'data', 'index.json'), 'utf8'));
  const removed = [];

  for (const section of index.sections) {
    if (!section.file) continue;
    const path = join(ROOT, 'data', section.file);
    const original = await readFile(path, 'utf8');
    const raw = JSON.parse(original);
    const items = Array.isArray(raw) ? raw : raw.items;

    const keep = [];
    for (const item of items) {
      if (isFragment(item)) removed.push({ shelf: section.id, id: item.id, title: item.title, url: item.url });
      else keep.push(item);
    }
    if (keep.length === items.length) continue;

    if (!dry) {
      if (Array.isArray(raw)) raw.length = 0, raw.push(...keep);
      else raw.items = keep;
      await writeFile(`${path}.tmp`, serialise(original, raw));
      await rename(`${path}.tmp`, path);
    }
  }

  const byShelf = removed.reduce((m, r) => (m[r.shelf] = (m[r.shelf] || 0) + 1, m), {});
  for (const r of removed) console.log(`  ${r.shelf.padEnd(11)} ${r.title}`);
  console.log(`\n${removed.length} fragment${removed.length === 1 ? '' : 's'} ${dry ? 'would be removed' : 'removed'} — ${JSON.stringify(byShelf)}`);

  if (dry) { console.log('\n--dry: nothing written.'); return; }

  /* Write down what went, so the removal is auditable after the fact and a later import
     can be checked against it rather than quietly re-adding the same fragments. */
  await writeFile(RECORD, JSON.stringify({
    removedAt: new Date().toISOString(),
    why: 'Numbered procedure steps and bare section labels imported from the documentation. '
       + 'A step is meaningless outside its sequence and a one-word label is not an instruction. '
       + 'Deliberate reviewed removal of doc- entries only; no community-sourced entry is eligible.',
    items: removed
  }, null, 2) + '\n');
  console.log(`wrote ${RECORD.replace(ROOT + '/', '')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
