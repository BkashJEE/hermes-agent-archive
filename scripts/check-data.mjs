#!/usr/bin/env node
/* Validate every data file: parseable JSON, unique ids, known sources, real dates. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = async f => JSON.parse(await readFile(join(ROOT, 'data', f), 'utf8'));

const cfg = await read('index.json');
const okSources = new Set(cfg.sources.map(s => s.id).concat('community'));
const ids = new Set();
const errors = [];
let total = 0;

for (const section of cfg.sections) {
  // A computed section (the dashboard) has no data file and nothing to validate.
  if (!section.file) { console.log(`  · ${section.id.padEnd(16)} computed, no data file`); continue; }
  const { items } = await read(section.file);
  for (const it of items) {
    total++;
    const where = `${section.file} → ${it.id || '(no id)'}`;
    if (!it.id)                       errors.push(`${where}: missing id`);
    else if (ids.has(it.id))          errors.push(`${where}: duplicate id`);
    else ids.add(it.id);
    if (!it.title)                    errors.push(`${where}: missing title`);
    if (!it.summary)                  errors.push(`${where}: missing summary`);
    if (!okSources.has(it.source))    errors.push(`${where}: unknown source "${it.source}"`);
    if (it.date && Number.isNaN(Date.parse(it.date))) errors.push(`${where}: bad date "${it.date}"`);
    if (it.url && !/^https?:\/\//.test(it.url))       errors.push(`${where}: bad url "${it.url}"`);
  }
  console.log(`  ✓ ${section.file.padEnd(16)} ${items.length} items`);
}

await read('live.json');
console.log(`\n${total} items across ${cfg.sections.length} sections.`);
if (errors.length) { console.error(`\n${errors.length} problem(s):`); for (const e of errors) console.error('  · ' + e); process.exit(1); }
console.log('All data files valid.');
