#!/usr/bin/env node
/**
 * Import the official Hermes Agent documentation, one shelf per page.
 *
 *   node scripts/import-hermes-docs.mjs            # import every page in the manifest
 *   node scripts/import-hermes-docs.mjs --dry      # report what would land, write nothing
 *   node scripts/import-hermes-docs.mjs user-guide/security   # one page
 *
 * `import-hermes-cli.mjs` reads exactly one page and can only ever produce Commands or
 * Settings: its URL is a constant, it needs a reference table that only the CLI page has,
 * and its router returns one of two shelves. Twenty-six documented pages had no importer
 * at all, which is why Skills sat at four entries.
 *
 * Routing lives in scripts/docs-manifest.json, declared per page and reviewed by a person.
 * The importer never guesses a shelf. Hidden Tricks and Prompts are refused outright, in
 * code as well as in the manifest: calling something a non-obvious trick, or a prompt
 * quoted verbatim, asserts something no parser can check, and those shelves are filled
 * only by reviewed extraction.
 *
 * The heading parsers are the ones the prompt verifier already uses and tests.
 */

import './env.mjs';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { codeBlocks, proseSections } from './extract-prompts.mjs';
import { makeAnchorSlugger } from './import-hermes-cli.mjs';
import { serialise } from './json-format.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://hermes-agent.nousresearch.com/docs/';

/* Filled only by reviewed extraction — see the module comment. */
const REFUSED_SHELVES = new Set(['tricks', 'prompts']);

/* Docusaurus appends a zero-width space and an anchor glyph to every heading. */
const cleanHeading = s => s.replace(/[​¶]/g, '').replace(/\s+/g, ' ').trim();

const idSlug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* Headings that are page furniture rather than something anyone can act on. */
const FURNITURE = /^(overview|introduction|summary|next steps?|see also|related|notes?|further reading|troubleshooting|faq|contents|on this page|examples?|options?|prerequisites?|requirements?|conclusion|what's next|tips)$/i;

/** One sentence, or a trimmed opening, to sit under the card title. */
function summarise(text) {
  const first = text.split(/(?<=[.!?])\s+/).find(s => s.trim().length > 30) || text;
  const line = first.trim();
  return line.length > 190 ? line.slice(0, 187).trimEnd() + '…' : line;
}

/**
 * Turn one documentation page into archive entries.
 *
 * A section earns a card when it has enough prose to say something on its own. Everything
 * shorter is a signpost between other sections, and shelving it would pad the archive with
 * cards that tell the reader nothing they could not have guessed from the heading.
 */
export function entriesFromPage(html, page, { shelf, tags = [] }, today) {
  if (REFUSED_SHELVES.has(shelf))
    throw new Error(`${page}: "${shelf}" is filled only by reviewed extraction, never by this importer`);

  /* Read the code blocks from the real page, but take the prose from a copy with the
     code removed. proseSections flattens whatever it is given, so a fenced block would
     otherwise land mid-sentence in a summary — "available as a slash command: # In the
     CLI ... /gif-search" is one sentence to a parser and nonsense to a reader. */
  const blocks = codeBlocks(html);
  const { sections } = proseSections(html.replace(/<pre[^>]*>[\s\S]*?<\/pre>/g, ' '));
  const slugger = makeAnchorSlugger();
  const byAnchor = new Map();
  for (const b of blocks) if (b.anchor && !byAnchor.has(b.anchor)) byAnchor.set(b.anchor, b.text);

  const out = [];
  for (const section of sections) {
    const title = cleanHeading(section.heading);
    /* Advance the slugger for every heading so repeat numbering matches the page, even
       for sections this importer goes on to skip. */
    slugger(title);
    if (!title || title.length > 90 || FURNITURE.test(title)) continue;

    const prose = section.text.replace(/[​]/g, '').trim();
    const snippet = byAnchor.get(section.anchor);
    /* Enough prose to stand on its own, or a command to run with enough words to say what
       it is for. Moving the code out of the prose made several genuinely useful sections
       look thin — a paste-and-run block with a one-line introduction is the most useful
       shape a card can have, not the least. */
    if (prose.length < (snippet ? 80 : 200)) continue;
    out.push({
      id: `doc-${idSlug(page)}-${idSlug(title)}`.slice(0, 80),
      title,
      summary: summarise(prose),
      detail: `${prose.length > 1200 ? prose.slice(0, 1200).trimEnd() + '…' : prose}\n\nFrom the official Hermes Agent documentation.`,
      ...(snippet ? { snippet } : {}),
      tags: [...new Set([...tags, 'docs'])],
      source: 'docs',
      url: `${BASE}${page}${page.endsWith('/') ? '' : ''}#${section.anchor}`,
      date: today,
      shelf
    });
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const dry = process.argv.includes('--dry');
  const manifest = JSON.parse(await readFile(join(ROOT, 'scripts', 'docs-manifest.json'), 'utf8'));
  const pages = args.length ? manifest.pages.filter(p => args.includes(p.path)) : manifest.pages;
  if (!pages.length) throw new Error('No manifest page matched. Pass a path exactly as the manifest spells it.');

  const index = JSON.parse(await readFile(join(ROOT, 'data', 'index.json'), 'utf8'));
  const files = new Map(index.sections.filter(s => s.file).map(s => [s.id, s.file]));

  /* Load every shelf once: ids and titles must stay unique across the whole archive. */
  const shelves = new Map();
  const seenIds = new Set();
  const seenTitles = new Set();
  for (const [id, file] of files) {
    const original = await readFile(join(ROOT, 'data', file), 'utf8');
    const raw = JSON.parse(original);
    const items = Array.isArray(raw) ? raw : raw.items;
    shelves.set(id, { file, original, raw, items });
    for (const it of items) { seenIds.add(it.id); seenTitles.add(`${id}::${it.title.trim().toLowerCase()}`); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const added = {};
  let skippedDuplicate = 0, failed = [];

  for (const page of pages) {
    let html;
    try {
      const res = await fetch(BASE + page.path, { headers: { 'user-agent': 'hermes-agent-archive/1.0' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      html = await res.text();
    } catch (error) { failed.push([page.path, error.message]); continue; }

    const entries = entriesFromPage(html, page.path, page, today);
    if (!entries.length) { failed.push([page.path, 'no section had enough prose — check the parser before assuming the page is thin']); continue; }

    let kept = 0;
    for (const entry of entries) {
      const { shelf, ...item } = entry;
      const target = shelves.get(shelf);
      if (!target) { failed.push([page.path, `unknown shelf "${shelf}"`]); break; }
      const titleKey = `${shelf}::${item.title.trim().toLowerCase()}`;
      /* Never replace what is already archived, and never introduce a duplicate title:
         two cards for one subject read as a bug even when both ids are unique. */
      if (seenIds.has(item.id) || seenTitles.has(titleKey)) { skippedDuplicate++; continue; }
      seenIds.add(item.id); seenTitles.add(titleKey);
      target.items.push(item);
      added[shelf] = (added[shelf] || 0) + 1;
      kept++;
    }
    console.log(`  ${page.path.padEnd(38)} ${String(kept).padStart(3)} new -> ${page.shelf}`);
  }

  const total = Object.values(added).reduce((a, b) => a + b, 0);
  console.log(`\n${total} new entries${skippedDuplicate ? `, ${skippedDuplicate} already archived` : ''}.`);
  for (const [shelf, n] of Object.entries(added)) console.log(`  ${shelf.padEnd(12)} +${n}`);
  for (const [path, why] of failed) console.log(`  unreadable: ${path} — ${why}`);

  if (dry) { console.log('\n--dry: nothing written.'); return; }
  if (!total) { console.log('Nothing new; files untouched.'); if (failed.length) process.exitCode = 1; return; }

  for (const { file, original, raw, items } of shelves.values()) {
    if (!items.length) continue;
    const path = join(ROOT, 'data', file);
    await writeFile(`${path}.tmp`, serialise(original, raw));
    await rename(`${path}.tmp`, path);
  }
  console.log('\nWritten. Run npm run check before committing.');
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
