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
import { fileURLToPath, pathToFileURL } from 'node:url';
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

/**
 * The anchor Docusaurus actually generates for a heading.
 *
 * `slug` above builds this archive's entry ids and must keep doing exactly what it does:
 * changing it would rename stored entries, and nothing here is ever renamed or dropped.
 * But it is the wrong function for a URL. It treats every hyphen as punctuation to
 * collapse, while github-slugger — which is what Docusaurus runs — keeps hyphens, removes
 * punctuation in place, and maps each remaining space to one hyphen without collapsing
 * runs. So `--format stream-json — structured JSONL output` anchors as
 * `--format-stream-json--structured-jsonl-output`, with the doubled hyphen the em dash
 * left behind, and a collapsed guess lands the reader at the top of the page instead.
 *
 * Repeated headings take the -1, -2 suffix github-slugger gives them, so a slugger
 * instance must live as long as one page's parse.
 */
export function makeAnchorSlugger() {
  const seen = new Map();
  return text => {
    const base = text.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')   // drop punctuation, leaving the spaces around it
      .replace(/\s/g, '-');        // one hyphen per space, runs preserved
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

/* One slugger for this page, so repeat headings number the way the page numbers them. */
const anchorSlug = makeAnchorSlugger();

/* Official reference material never belongs in Hidden Tricks. */
function shelfFor(title, body) {
  if (/^--/.test(title.trim())) return 'settings';
  if (/^\/|slash command|mid-session|shortcut|press |keybinding/i.test(title)) return 'commands';
  if (/^hermes[- ]|^hermes$/i.test(title.trim())) return 'commands';
  if (/\boption|config|environment variable|\.toml|settings|credential|auth\b/i.test(`${title} ${body}`)) return 'settings';
  return 'commands';
}

/* Only import when run as a command. The slugger above is exported for its tests, and
   importing this module used to fetch the reference page and rewrite two shelves as a
   side effect of loading it — a test run silently added five entries. */
if (!(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) {
  /* Imported for the exports alone; stop before anything reaches the network or disk. */
} else await runImport();

async function runImport() {

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
  if (!title) continue;

  /* Slug every heading the page has, in page order, before any of the filters below can
     skip one. The slugger numbers repeats — Examples, Examples-1, Examples-2 — so it has
     to see the same sequence the page did; letting a skipped section miss its turn would
     shift the suffix on every later repeat and quietly point those links at the wrong
     part of the page. */
  const anchor = anchorSlug(title);
  if (title.length > 90) continue;

  const prose = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(p => strip(p[1])).filter(Boolean);
  if (!prose.length || prose[0].length < 15) continue;     // ditto for a section with no real lead

  const codeMatch = body.match(/<div class="codeBlockLines_[^"]*">([\s\S]*?)<\/div><\/div>/);
  const code = codeMatch
    ? [...codeMatch[1].matchAll(/<span class="token-line"[^>]*>([\s\S]*?)<\/span><\/span>/g)]
        .map(l => strip(l[1])).filter(Boolean).slice(0, 12).join('\n')
    : undefined;

  sections++;

  /* A documented section usually describes a command the reference table has
     already listed. Fold it into that entry instead of shelving a second card
     for the same subject: the table gives the better one-line purpose, the
     section gives the detail and the example. */
  const existing = items.find(i => i.id === `cli-${slug(title)}`);
  if (existing) {
    const extra = prose.slice(0, 4).join('\n\n');
    if (extra && !existing.detail.includes(extra.slice(0, 40))) {
      existing.detail = `${existing.summary}\n\n${extra}\n\nFrom the official Hermes Agent CLI reference.`;
    }
    if (code && !existing.snippet) existing.snippet = code;
    existing.url = `${SRC}#${anchor}`;               // deep-link to the section
    continue;
  }

  push({
    id: `cli-sec-${slug(title)}`,
    title,
    summary: prose[0].length > 190 ? prose[0].slice(0, 187).trimEnd() + '…' : prose[0],
    detail: prose.slice(0, 4).join('\n\n') + `\n\nFrom the official Hermes Agent CLI reference.`,
    snippet: code || undefined,
    tags: ['cli', 'reference'],
    source: 'docs',
    url: `${SRC}#${anchor}`,
    date: new Date().toISOString().slice(0, 10),
    shelf: shelfFor(title, prose.join(' '))
  });
}

/* ---- merge onto shelves, never replacing ---- */
const counts = {};
for (const shelf of ['commands', 'settings']) {
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
}
