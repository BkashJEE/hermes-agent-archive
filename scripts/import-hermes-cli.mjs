#!/usr/bin/env node
/**
 * Import the official Hermes Agent CLI reference into the archive's shelves.
 *
 *   https://hermes-agent.nousresearch.com/docs/reference/cli-commands
 *
 * The page carries two useful shapes: reference tables (Command | Purpose) and
 * documented sections (heading, prose, code block). Both are taken as published —
 * wording is Nous's, not a paraphrase, and every entry links back to its anchor.
 *
 * Additive: entries merge by id, so nothing already archived is removed by a re-run.
 *
 *   node scripts/import-hermes-cli.mjs
 */

import './env.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://hermes-agent.nousresearch.com/docs/reference/cli-commands';

const strip = h => h
  .replace(/<[^>]+>/g, '')
  .replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/​/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54);

/* Which shelf an entry belongs on. Deliberately conservative: anything that is
   plainly a command goes to commands, configuration to settings, and only the
   non-obvious in-session moves to tricks. */
function shelfFor(title, body) {
  const t = `${title} ${body}`;
  if (/^\/|slash command|mid-session|shortcut|press |keybinding/i.test(title)) return 'tricks';
  if (/^hermes[- ]|^hermes$/i.test(title.trim())) return 'commands';
  if (/\boption|config|environment variable|\.toml|settings|credential|auth\b/i.test(t)) return 'settings';
  if (/^--/.test(title.trim())) return 'tricks';
  return 'commands';
}

const res = await fetch(SRC, { headers: { 'user-agent': 'hermes-agent-archive/1.0' }, signal: AbortSignal.timeout(30000) });
if (!res.ok) throw new Error(`${SRC} — ${res.status} ${res.statusText}`);
const html = await res.text();

const items = [];
const seen = new Set();
const push = it => { if (!seen.has(it.id)) { seen.add(it.id); items.push(it); } };

/* ---- 1. reference tables: <td><code>hermes x</code></td><td>purpose</td> ---- */
let tableRows = 0;
for (const m of html.matchAll(/<tr><td><code>([^<]+)<\/code><\/td><td>([\s\S]*?)<\/td>/g)) {
  const cmd = strip(m[1]);
  const purpose = strip(m[2]);
  if (!cmd || !purpose || purpose.length < 15) continue;   // a purpose that short says nothing
  tableRows++;
  push({
    id: `cli-${slug(cmd)}`,
    title: cmd,
    summary: purpose,
    detail: `${purpose}\n\nFrom the official Hermes Agent CLI reference.`,
    snippet: /^(hermes|--|\/)/.test(cmd) ? cmd : undefined,
    tags: ['cli', 'reference'],
    source: 'docs',
    url: SRC,
    date: new Date().toISOString().slice(0, 10),
    shelf: shelfFor(cmd, purpose)
  });
}

/* ---- 2. documented sections: heading, following prose, first code block ---- */
let sections = 0;
const parts = html.split(/<h([23])[^>]*>/).slice(1);
for (let i = 0; i < parts.length; i += 2) {
  const chunk = parts[i + 1] || '';
  const endOfHeading = chunk.indexOf('</h' + parts[i] + '>');
  if (endOfHeading === -1) continue;

  const title = strip(chunk.slice(0, endOfHeading));
  const body = chunk.slice(endOfHeading);
  if (!title || title.length > 90) continue;

  const prose = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(p => strip(p[1])).filter(Boolean);
  if (!prose.length || prose[0].length < 15) continue;     // ditto for a section with no real lead

  const codeMatch = body.match(/<div class="codeBlockLines_[^"]*">([\s\S]*?)<\/div><\/div>/);
  const code = codeMatch
    ? [...codeMatch[1].matchAll(/<span class="token-line"[^>]*>([\s\S]*?)<\/span><\/span>/g)]
        .map(l => strip(l[1])).filter(Boolean).slice(0, 12).join('\n')
    : undefined;

  sections++;
  push({
    id: `cli-sec-${slug(title)}`,
    title,
    summary: prose[0].length > 190 ? prose[0].slice(0, 187).trimEnd() + '…' : prose[0],
    detail: prose.slice(0, 4).join('\n\n') + `\n\nFrom the official Hermes Agent CLI reference.`,
    snippet: code || undefined,
    tags: ['cli', 'reference'],
    source: 'docs',
    url: `${SRC}#${slug(title)}`,
    date: new Date().toISOString().slice(0, 10),
    shelf: shelfFor(title, prose.join(' '))
  });
}

/* ---- merge onto shelves, never replacing ---- */
const counts = {};
for (const shelf of ['commands', 'settings', 'tricks']) {
  const file = join(ROOT, `data/${shelf}.json`);
  const current = JSON.parse(await readFile(file, 'utf8').catch(() => '{"items":[]}'));
  const byId = new Map((current.items || []).map(i => [i.id, i]));
  let added = 0;

  for (const it of items.filter(i => i.shelf === shelf)) {
    const { shelf: _, ...entry } = it;
    if (byId.has(entry.id)) byId.set(entry.id, { ...byId.get(entry.id), ...entry });
    else { byId.set(entry.id, entry); added++; }
  }

  current.note = `Imported from the official Hermes Agent CLI reference (${SRC}) by scripts/import-hermes-cli.mjs, merged with anything already here. Wording is Nous's own.`;
  current.items = [...byId.values()];
  await writeFile(file, JSON.stringify(current, null, 2) + '\n');
  counts[shelf] = { total: current.items.length, added };
}

console.log(`\nParsed ${tableRows} reference rows and ${sections} documented sections → ${items.length} unique entries.\n`);
for (const [shelf, c] of Object.entries(counts)) console.log(`  ${shelf.padEnd(9)} +${String(c.added).padStart(3)} new   ${c.total} total`);
