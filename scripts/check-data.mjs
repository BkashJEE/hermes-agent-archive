#!/usr/bin/env node
/* Validate every data file: parseable JSON, unique ids, known sources, real dates. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODEL, RANKING_VERSION, validAssessment } from '../assets/js/ranking.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = async f => JSON.parse(await readFile(join(ROOT, 'data', f), 'utf8'));

const cfg = await read('index.json');
const okSources = new Set(cfg.sources.map(s => s.id).concat('community'));
const ids = new Set();
let titles = new Map();
const errors = [];
let total = 0;

for (const section of cfg.sections) {
  // A computed section (the dashboard) has no data file and nothing to validate.
  if (!section.file) { console.log(`  · ${section.id.padEnd(16)} computed, no data file`); continue; }
  titles = new Map();   // titles must be unique within a shelf, not across them
  const { items } = await read(section.file);
  for (const it of items) {
    total++;
    const where = `${section.file} → ${it.id || '(no id)'}`;
    if (!it.id)                       errors.push(`${where}: missing id`);
    else if (ids.has(it.id))          errors.push(`${where}: duplicate id`);
    else ids.add(it.id);
    if (!it.title)                    errors.push(`${where}: missing title`);
    else {
      // Two entries about the same subject with different ids read as a bug to a
      // visitor even though every id is unique. The importer once shelved both a
      // reference row and its documented section for 46 commands.
      const t = it.title.trim().toLowerCase();
      if (titles.has(t)) errors.push(`${where}: duplicate title "${it.title}" (also ${titles.get(t)})`);
      else titles.set(t, it.id);
    }
    if (!it.summary)                  errors.push(`${where}: missing summary`);
    if (!okSources.has(it.source))    errors.push(`${where}: unknown source "${it.source}"`);
    if (it.date && Number.isNaN(Date.parse(it.date))) errors.push(`${where}: bad date "${it.date}"`);
    if (it.url && !/^https?:\/\//.test(it.url))       errors.push(`${where}: bad url "${it.url}"`);

    /* The archive's promise is that every entry links to its source and credits whoever
       made it. Both halves are checkable here, where a contributor sees the failure
       before opening a pull request rather than after review.

       A GitHub entry stores `repo` instead of `url`; either is a source link. Official
       documentation is exempt from the credit rule on purpose — the source label already
       says where it came from, and attaching a person's name to it would be worse than
       leaving it off. `credit` carries a stated provenance for a figure the author
       supplied themselves. */
    if (!it.url && !it.repo)          errors.push(`${where}: no source link (needs url or repo)`);
    if (it.source !== 'docs' && !it.author && !it.credit)
      errors.push(`${where}: no author — name whoever made it, or use "credit" to state the provenance`);
  }
  console.log(`  ✓ ${section.file.padEnd(16)} ${items.length} items`);
}

await read('live.json');
try {
  const rankings = await read('rankings.json');
  if (rankings.version !== RANKING_VERSION || rankings.model !== MODEL || !rankings.results || typeof rankings.results !== 'object')
    errors.push('rankings.json: unsupported or malformed classification file');
  else for (const [id, result] of Object.entries(rankings.results))
    if (!validAssessment(result)) errors.push(`rankings.json → ${id}: invalid classification`);
} catch (error) {
  if (error.code !== 'ENOENT') errors.push(`rankings.json: ${error.message}`);
}
console.log(`\n${total} items across ${cfg.sections.length} sections.`);
if (errors.length) { console.error(`\n${errors.length} problem(s):`); for (const e of errors) console.error('  · ' + e); process.exit(1); }
console.log('All data files valid.');
