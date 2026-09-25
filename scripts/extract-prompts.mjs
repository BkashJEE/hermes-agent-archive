#!/usr/bin/env node
/**
 * Verify every stored prompt against the documentation page it claims to come from.
 *
 *   node scripts/extract-prompts.mjs            # verify, write the excerpt record
 *   node scripts/extract-prompts.mjs --offline  # verify against the stored record only
 *   node scripts/extract-prompts.mjs --report   # verify, print every block, write nothing
 *
 * Each entry in data/prompts.json carries a `snippet` the reader is invited to copy and
 * a `url` ending in a heading anchor. Both claims are checkable: the anchor either exists
 * on that page or it does not, and the snippet either appears in a code block under that
 * heading or it does not. This checks both, for all of them, from the published HTML.
 *
 * The result is written to scripts/prompt-excerpts.json — the page, the anchor, the
 * heading, and the exact text of every code block that was read. That file is what makes
 * this reproducible: a later run can re-check the same claims offline, and a change
 * upstream shows up as a diff rather than as silence.
 *
 * Nothing here edits data/prompts.json. Verification reports; it does not repair.
 * A page that cannot be fetched is reported as unverified and exits non-zero, because a
 * green run that skipped half its checks is worse than a red one.
 */

import './env.mjs';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROMPTS = join(ROOT, 'data', 'prompts.json');
const RECORD = join(ROOT, 'scripts', 'prompt-excerpts.json');

const OFFLINE = process.argv.includes('--offline');
const REPORT = process.argv.includes('--report');

/* Docusaurus renders entities and wraps every line in its own element. Undo both so a
   block compares as the text a reader would actually copy off the page. */
const decode = s => s
  .replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&amp;/g, '&');

/* Compare on shape, not on spacing: trailing blanks and indentation survive a copy
   badly, and a prompt that differs only in those is still the same prompt. */
const normalise = s => decode(s)
  .replace(/\r\n?/g, '\n')
  .split('\n').map(line => line.replace(/\s+$/, '')).join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/**
 * Every code block on a Docusaurus page, each tagged with the heading it sits under.
 *
 * The generated class names carry a build hash (`codeBlock_bY9V`), so this matches the
 * stable `prism-code` marker instead. If that changes the function returns nothing and
 * the caller fails loudly — which is the point.
 */
export function codeBlocks(html) {
  const out = [];
  /* Heading anchors in document order, so each block can be attributed to one. */
  const headings = [...html.matchAll(/<h([2-4])[^>]*\bid="([^"]+)"[^>]*>(.*?)<\/h\1>/gs)]
    .map(m => ({ at: m.index, anchor: m[2], text: decode(m[3].replace(/<[^>]+>/g, '')).trim() }));

  for (const m of html.matchAll(/<pre[^>]*class="[^"]*prism-code[^"]*language-([\w-]+)[^"]*"[^>]*>(.*?)<\/pre>/gs)) {
    const lines = [...m[2].matchAll(/<div class="token-line"[^>]*>(.*?)<\/div>/gs)]
      .map(l => decode(l[1].replace(/<br\s*\/?>/g, '').replace(/<[^>]+>/g, '')));
    if (!lines.length) continue;
    /* The last heading that opens before this block is the one it belongs to. */
    let owner = null;
    for (const h of headings) { if (h.at < m.index) owner = h; else break; }
    out.push({
      language: m[1],
      anchor: owner?.anchor ?? null,
      heading: owner?.text ?? null,
      text: normalise(lines.join('\n'))
    });
  }
  return out;
}

/**
 * The readable prose of each heading section, and every anchor the page defines.
 *
 * Not every prompt in the docs is fenced. Some are quoted inside a sentence — Say "save
 * what you just did as a skill called `deploy-staging`." — and those are prompts just as
 * much as the fenced ones. Checking code blocks alone would report a true entry as false.
 */
export function proseSections(html) {
  const body = html.replace(/<(script|style|nav|header|footer)\b[^>]*>.*?<\/\1>/gs, '');
  const heads = [...body.matchAll(/<h([2-4])[^>]*\bid="([^"]+)"[^>]*>(.*?)<\/h\1>/gs)];
  const anchors = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const sections = heads.map((m, i) => ({
    anchor: m[2],
    heading: decode(m[3].replace(/<[^>]+>/g, '')).trim(),
    /* Up to the next heading; the last one runs to the end of the body. */
    text: flatten(body.slice(m.index + m[0].length, heads[i + 1]?.index ?? body.length))
  }));
  return { sections, anchors };
}

/* Page prose as one comparable line: tags gone, entities resolved, runs of space
   collapsed, and the typographic quotes a CMS substitutes folded back to plain ones. */
const flatten = s => decode(s.replace(/<[^>]+>/g, ' '))
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-').replace(/​/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/* A snippet written for the archive carries markdown backticks around inline code; the
   rendered page does not. Strip them so the two forms of the same sentence compare. */
const asProse = s => flatten(s).replace(/`/g, '').replace(/\s+([.,;:!?])/g, '$1');

const pageOf = url => url.split('#')[0];
const anchorOf = url => url.includes('#') ? url.split('#').slice(1).join('#') : null;

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'hermes-agent-archive/1.0 (+https://github.com/BkashJEE/hermes-agent-archive)' },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

/* Only verify when run as a command. Importing this module — which the parser tests do —
   must not reach the network or rewrite the excerpt record. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

async function main() {

const raw = JSON.parse(await readFile(PROMPTS, 'utf8'));
const prompts = Array.isArray(raw) ? raw : raw.items;
if (!prompts?.length) throw new Error('data/prompts.json holds no entries — nothing to verify.');

/* One fetch per page, however many prompts quote it. */
const pages = [...new Set(prompts.map(p => pageOf(p.url)))].sort();
const stored = await readFile(RECORD, 'utf8').then(t => (t.trim() ? JSON.parse(t) : null)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });

const record = { generatedAt: new Date().toISOString(), source: 'hermes-agent.nousresearch.com', pages: {} };
const unreachable = [];

for (const page of pages) {
  if (OFFLINE) {
    const kept = stored?.pages?.[page];
    if (!kept) { unreachable.push([page, 'no stored excerpts; run without --offline first']); continue; }
    record.pages[page] = kept;
    continue;
  }
  try {
    const html = await fetchPage(page);
    const blocks = codeBlocks(html);
    const { sections, anchors } = proseSections(html);
    if (!blocks.length && !sections.length) throw new Error('no code blocks or headings parsed — the page markup changed');
    record.pages[page] = { fetchedAt: new Date().toISOString(), anchors: [...anchors].sort(), blocks, sections };
  } catch (error) {
    unreachable.push([page, error.message]);
    /* Never discard a good record because one fetch failed. */
    if (stored?.pages?.[page]) record.pages[page] = stored.pages[page];
  }
}

const results = prompts.map(p => {
  const page = record.pages[pageOf(p.url)];
  const anchor = anchorOf(p.url);
  if (!page) return { ...p, status: 'unverified', why: 'page could not be read' };

  const anchors = new Set(page.anchors ?? page.blocks.map(b => b.anchor).filter(Boolean));
  const want = normalise(p.snippet ?? '');
  if (!want) return { ...p, status: 'no-snippet', why: 'entry stores no snippet to verify' };

  /* A link that points at a heading which no longer exists is broken even if the text
     is still somewhere on the page — the reader lands at the top and has to hunt. */
  if (anchor && !anchors.has(anchor))
    return { ...p, status: 'dead-anchor', why: `#${anchor} is not a heading on that page` };

  const exact = page.blocks.find(b => b.text === want);
  const contains = exact ?? page.blocks.find(b => b.text.includes(want));
  if (contains) {
    if (anchor && contains.anchor !== anchor)
      return { ...p, status: 'wrong-anchor', why: `snippet lives under #${contains.anchor ?? '(no heading)'}, not #${anchor}` };
    return { ...p, status: exact ? 'verified' : 'verified-substring',
             why: exact ? 'exact match in a code block under the linked heading'
                        : 'found inside a larger code block under the linked heading' };
  }

  /* Not fenced: look for it as quoted prose in the section the link names. */
  const needle = asProse(p.snippet);
  const inSection = (page.sections ?? []).find(s => s.anchor === anchor && asProse(s.text).includes(needle));
  if (inSection) return { ...p, status: 'verified-prose', why: `quoted in the prose under "${inSection.heading}"` };

  const elsewhere = (page.sections ?? []).find(s => asProse(s.text).includes(needle));
  if (elsewhere) return { ...p, status: 'wrong-anchor', why: `text is under #${elsewhere.anchor}, not #${anchor}` };

  return { ...p, status: 'missing', why: 'snippet is not in any code block or prose on that page' };
});

const tally = results.reduce((m, r) => (m[r.status] = (m[r.status] || 0) + 1, m), {});
const bad = results.filter(r => !r.status.startsWith('verified'));

for (const r of results) {
  const mark = r.status.startsWith('verified') ? '✓' : '✗';
  console.log(`${mark} ${r.status.padEnd(18)} ${r.id}`);
  if (!r.status.startsWith('verified')) console.log(`    ${r.why}\n    ${r.url}`);
}

if (REPORT) {
  console.log('\nCode blocks read:');
  for (const [page, p] of Object.entries(record.pages))
    for (const b of p.blocks)
      console.log(`  ${page.replace('https://hermes-agent.nousresearch.com/docs/', '')}  #${b.anchor ?? '-'}  [${b.language}]  ${b.text.split('\n')[0].slice(0, 60)}…`);
}

console.log(`\n${prompts.length} prompts across ${pages.length} pages — ${JSON.stringify(tally)}`);
for (const [page, why] of unreachable) console.log(`unreachable: ${page} — ${why}`);

if (unreachable.length || bad.length) {
  console.error(`\n${bad.length} prompt(s) unverified, ${unreachable.length} page(s) unreadable.`);
  process.exit(1);
}

if (!REPORT && !OFFLINE) {
  const tmp = `${RECORD}.tmp`;
  await writeFile(tmp, JSON.stringify(record, null, 2) + '\n');
  await rename(tmp, RECORD);
  console.log(`wrote ${RECORD.replace(ROOT + '/', '')}`);
}
}
