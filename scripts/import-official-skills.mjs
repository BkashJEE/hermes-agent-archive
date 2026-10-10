#!/usr/bin/env node
/**
 * Import the official Hermes skill catalogue.
 *
 *   npm run skills            # fetch the catalogue, import what is missing
 *   npm run skills -- --dry   # report, write nothing
 *   npm run skills -- --cached  # reuse the last download instead of fetching 63 MB
 *   npm run skills -- --pack anthropic   # the one vendor pack that clears the star floor
 *
 * The Skills shelf held 66 entries. The official catalogue at
 * docs/api/skills.json holds 101,748, and almost all of that is other people's
 * directories indexed by the site — ClawHub alone contributes 79,491. Catalogue presence
 * is not a recommendation, so none of that is imported here.
 *
 * Two sources in it are the official product:
 *
 *   built-in (58)   ship inside NousResearch/hermes-agent; every install has them
 *   optional (152)  the official optional catalogue, installed by `official/<cat>/<name>`
 *
 * Provenance is the admission test, not quality. These are the skills Hermes itself
 * publishes, each with a documentation page on the official site that this script verifies
 * resolves before shelving anything. That is a fact about the catalogue rather than a
 * judgement about which skill is good, which is the only basis this archive accepts.
 *
 * Plugins are deliberately absent. An official plugin lives in its own repository with
 * between 2 and 86 stars, and the GitHub cutoff in AGENTS.md covers URL-only entries on
 * purpose — linking one through its documentation page would be routing around the floor
 * rather than meeting it. That needs the owner's decision, not an importer.
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { serialise } from './json-format.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELF = join(ROOT, 'data', 'skills.json');
const RECORD = join(ROOT, 'scripts', 'imported-official-skills.json');
const CACHE = join(tmpdir(), 'hermes-archive-skills-catalogue.json');

const CATALOGUE = 'https://hermes-agent.nousresearch.com/docs/api/skills.json';
const DOCS = 'https://hermes-agent.nousresearch.com/docs/user-guide/skills/';
/* The two the site publishes itself. Every other value in `source` is a third-party
   directory the site indexes, and being listed in one says nothing about quality. */
const OFFICIAL = new Set(['built-in', 'optional']);

/*
 * Vendor packs: skill sets a third party publishes and the Hermes catalogue mirrors, each
 * installed by `hermes skills install <owner>/<repo>/skills/<name>`. They have no page on
 * the Hermes site, so an entry links to the skill's source tree on GitHub — which makes it
 * a GitHub entry, and the 50,000-star floor applies. On 2026-10-09: anthropics/skills
 * 180,051 stars (admitted), openai/skills 27,953 and huggingface/skills 11,151 (not).
 * The floor is checked at render time against the fetched count, not asserted here.
 */
const PACKS = {
  anthropic: { source: 'Anthropic', repo: 'anthropics/skills', author: 'Anthropic', prefix: 'anthropics/skills/skills/' }
};

/**
 * Acronyms and proper names a word-by-word capitaliser gets wrong.
 *
 * These are card titles, and the highest-ranked of them are the first thing a visitor
 * reads. `Docx`, `Powerpoint` and `Har Derived Api Client` look like nobody checked.
 */
const SPELLINGS = new Map(Object.entries({
  ai: 'AI', api: 'API', oss: 'OSS', har: 'HAR', cli: 'CLI', pdf: 'PDF', docx: 'DOCX',
  xlsx: 'XLSX', pptx: 'PPTX', url: 'URL', sql: 'SQL', http: 'HTTP', mcp: 'MCP',
  llm: 'LLM', tts: 'TTS', csv: 'CSV', json: 'JSON', yaml: 'YAML', ssh: 'SSH',
  aws: 'AWS', gpu: 'GPU', ocr: 'OCR', seo: 'SEO', rss: 'RSS', ui: 'UI', ux: 'UX',
  ide: 'IDE', npm: 'npm', sdk: 'SDK', qr: 'QR', vpn: 'VPN', dns: 'DNS', xml: 'XML',
  svg: 'SVG', nlp: 'NLP', oauth: 'OAuth', gif: 'GIF', sh: 'sh',
  powerpoint: 'PowerPoint', github: 'GitHub', gitlab: 'GitLab', youtube: 'YouTube',
  openai: 'OpenAI', nvidia: 'NVIDIA', tensorrt: 'TensorRT', stripe: 'Stripe'
}));

/** `apple-notes` → `Apple Notes`, leaving existing capitalisation alone. */
const titleCase = name => name
  .split(/[-_]/)
  .map(w => SPELLINGS.get(w.toLowerCase())
         ?? (/[A-Z]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
  .join(' ');

/** Compare links without a fragment: the reviewed import stored `#skill-metadata`. */
const sameLink = url => String(url || '').split('#')[0].replace(/\/$/, '').toLowerCase();

async function catalogue(useCache) {
  if (useCache) {
    try { return JSON.parse(await readFile(CACHE, 'utf8')); }
    catch { console.log('no cached catalogue; fetching'); }
  }
  const res = await fetch(CATALOGUE, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`${CATALOGUE} — ${res.status} ${res.statusText}. The shelf is untouched.`);
  const text = await res.text();
  await writeFile(CACHE, text);                       // outside the repo; 63 MB is not content
  return JSON.parse(text);
}

/**
 * Does this skill's documentation page exist? An entry with a dead link is not an entry.
 *
 * A HEAD response is only believed when it succeeds. This site answers 503 to HEAD and 200
 * to GET on the same URL, and an earlier version of this check trusted the 503 and dropped
 * a live skill — so a failed HEAD means nothing was learned, not that the page is gone.
 */
async function resolves(url) {
  const head = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (head?.ok) return true;
  const get = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(25000) }).catch(() => null);
  return !!get?.ok;
}

/** Run `work` over `items`, a few at a time, so 190 checks do not open 190 sockets. */
async function pooled(items, width, work) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(width, queue.length) }, async () => {
    while (queue.length) await work(queue.shift());
  }));
}

/** A placeholder in the author field is worse than an empty one: it looks like a credit. */
const PLACEHOLDER_AUTHORS = new Set(['hermes agent', 'community', 'unknown', 'anonymous', 'n/a']);
/** Co-authors arrive as an array; a credit is one string. */
export const authorText = author =>
  (Array.isArray(author) ? author.filter(Boolean).join(', ') : String(author ?? '')).trim();

export const namesSomeone = author => {
  const text = authorText(author);
  return !!text && !PLACEHOLDER_AUTHORS.has(text.toLowerCase());
};

export function packEntry(skill, pack, verifiedAt) {
  const name = (skill.installIdentifier || '').slice(pack.prefix.length) || skill.name;
  const tags = ['skills', 'vendor-pack', pack.author.toLowerCase()];
  if (skill.category) tags.push(skill.category);
  for (const tag of skill.tags || []) {
    const clean = String(tag).toLowerCase().trim();
    if (clean && !tags.includes(clean) && tags.length < 7) tags.push(clean);
  }
  return {
    id: `skill-pack-${pack.author.toLowerCase()}-${name}`,
    title: titleCase(name),
    summary: skill.description,
    detail: [skill.overview || skill.description,
             `Published by ${pack.author} in the ${pack.repo} repository and installed into Hermes from the official skill catalogue.`].join('\n\n'),
    snippet: skill.installCmd,
    tags,
    source: 'github',
    repo: pack.repo,
    author: pack.author,
    url: `https://github.com/${pack.repo}/tree/main/skills/${name}`,
    verifiedAt
  };
}

export function buildEntry(skill, verifiedAt) {
  const tags = ['skills', skill.source === 'built-in' ? 'built-in' : 'optional'];
  if (skill.category) tags.push(skill.category);
  for (const tag of skill.tags || []) {
    const clean = String(tag).toLowerCase().trim();
    if (clean && !tags.includes(clean) && tags.length < 7) tags.push(clean);
  }

  /* What a reader needs to decide whether to install it, in the order they need it. The
     official wording is kept rather than paraphrased, because a summary of a summary of a
     skill is where accuracy goes to die. */
  const facts = [];
  if (skill.platforms?.length) facts.push(`Platforms: ${skill.platforms.join(', ')}.`);
  if (skill.commands?.length) facts.push(`Needs: ${skill.commands.join(', ')}.`);
  if (skill.envVars?.length) facts.push(`Environment: ${skill.envVars.join(', ')}.`);

  return {
    id: `skill-${skill.source === 'built-in' ? 'bundled' : 'optional'}-${skill.category}-${skill.name}`,
    title: titleCase(skill.name),
    summary: skill.description,
    detail: [skill.overview || skill.description, facts.join(' ')].filter(Boolean).join('\n\n'),
    snippet: skill.installCmd,
    tags,
    source: 'docs',
    /* Exempt for docs entries, but the catalogue names real people and this archive
       credits them wherever it can. `Hermes Agent` and `community` are not names and
       credit nobody; the source label already says where the entry came from. */
    ...(namesSomeone(skill.author) ? { author: authorText(skill.author) } : {}),
    url: DOCS + skill.docsPath,
    verifiedAt
  };
}

async function main() {
  const dry = process.argv.includes('--dry');
  const verifiedAt = new Date().toISOString().slice(0, 10);

  const all = await catalogue(process.argv.includes('--cached'));
  const packArg = process.argv.indexOf('--pack');
  const pack = packArg > -1 ? PACKS[process.argv[packArg + 1]] : null;
  if (packArg > -1 && !pack) throw new Error(`Unknown pack. Known: ${Object.keys(PACKS).join(', ')}`);
  const official = pack
    ? all.filter(s => s.source === pack.source && s.name && s.description && (s.installIdentifier || '').startsWith(pack.prefix))
    : all.filter(s => OFFICIAL.has(s.source) && s.name && s.description && s.docsPath);

  const original = await readFile(SHELF, 'utf8');
  const shelf = JSON.parse(original);
  const items = Array.isArray(shelf) ? shelf : shelf.items;

  /* Three ways the same skill could already be here. The reviewed import of September 28
     shelved twenty of these with its own ids and a `#skill-metadata` link, and the
     validator rejects a repeated title within a shelf as well as a repeated id. */
  const haveId = new Set(items.map(i => i.id));
  const haveLink = new Set(items.map(i => sameLink(i.url)));
  const haveTitle = new Set(items.map(i => (i.title || '').trim().toLowerCase()));

  const fresh = [];
  const already = [];
  for (const skill of official) {
    const entry = pack ? packEntry(skill, pack, verifiedAt) : buildEntry(skill, verifiedAt);
    if (haveId.has(entry.id) || haveLink.has(sameLink(entry.url)) || haveTitle.has(entry.title.toLowerCase())) {
      already.push(entry.title);
      continue;
    }
    /* Also guard against the catalogue itself offering one name twice across categories. */
    haveId.add(entry.id); haveLink.add(sameLink(entry.url)); haveTitle.add(entry.title.toLowerCase());
    fresh.push(entry);
  }

  console.log(`catalogue: ${all.length} listings, ${official.length} published by Hermes itself`);
  console.log(`  already on the shelf : ${already.length}`);
  console.log(`  new                  : ${fresh.length}`);

  /* Verify every link before shelving. The archive's promise is that each entry reaches
     its source, and a 404 on a card is worse than a thinner shelf. */
  const dead = [];
  await pooled(fresh, 8, async entry => {
    if (!await resolves(entry.url)) dead.push(entry);
  });
  const keep = fresh.filter(e => !dead.includes(e));
  console.log(`  links verified       : ${keep.length}${dead.length ? `, ${dead.length} dead and dropped` : ''}`);
  for (const e of dead) console.log(`      dropped ${e.title} — ${e.url}`);

  const byTag = keep.reduce((m, e) => (m[e.tags[1]] = (m[e.tags[1]] || 0) + 1, m), {});
  if (pack) console.log(`  pack ${pack.repo}: rendered only once its fetched star count clears the floor`);
  console.log(`  ${JSON.stringify(byTag)}`);

  if (dry) { console.log('\n--dry: nothing written.'); return; }
  if (!keep.length) { console.log('\nnothing new to add; the shelf is untouched.'); return; }

  /* Additive, as AGENTS.md requires: append, never rewrite or reorder what is here. */
  if (Array.isArray(shelf)) shelf.push(...keep);
  else shelf.items = [...items, ...keep];
  await writeFile(`${SHELF}.tmp`, serialise(original, shelf));
  await rename(`${SHELF}.tmp`, SHELF);

  /* The record accumulates. It is the audit trail for every skill this script has ever
     shelved, and a run that replaced it would erase the previous runs — which the first
     pack import did, leaving a file that listed 16 entries and forgot 192. */
  await mkdir(dirname(RECORD), { recursive: true });
  let record = { source: CATALOGUE, note: '', passes: [] };
  try {
    const prior = JSON.parse(await readFile(RECORD, 'utf8'));
    record.passes = prior.passes ?? (prior.imported ? [{ importedAt: prior.importedAt, what: 'official', counts: prior.counts, imported: prior.imported }] : []);
  } catch { /* first run */ }
  record.note = 'Skills shelved from the official Hermes catalogue: the built-in set, the official '
    + 'optional catalogue, and vendor packs whose repository clears the GitHub star floor. '
    + 'Admitted on provenance, not on a judgement of quality; every link verified to resolve at '
    + 'import. Third-party directories indexed by the same catalogue are excluded.';
  record.passes.push({
    importedAt: new Date().toISOString(),
    what: pack ? `pack ${pack.repo}` : 'official',
    counts: { catalogue: all.length, candidates: official.length, imported: keep.length, alreadyPresent: already.length, deadLinks: dead.length },
    imported: keep.map(e => ({ id: e.id, title: e.title, url: e.url }))
  });
  record.totalImported = record.passes.reduce((n, p) => n + p.imported.length, 0);
  await writeFile(RECORD, JSON.stringify(record, null, 2) + '\n');

  console.log(`\nadded ${keep.length} to data/skills.json (${items.length} → ${items.length + keep.length})`);
  console.log(`wrote ${RECORD.replace(ROOT + '/', '')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
