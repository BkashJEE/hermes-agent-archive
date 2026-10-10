#!/usr/bin/env node
/**
 * Shelve the Hermes plugins a reader can trust the provenance of.
 *
 *   npm run plugins            # fetch the catalogue, import what is missing
 *   npm run plugins -- --dry   # report, write nothing
 *
 * The official catalogue at docs/api/plugins.json lists 540 plugins. Two kinds are shelved:
 *
 *   official   Published by Nous Research itself (`tier: official`). Each has a page on the
 *              official site at /docs/plugins/<name>, verified to resolve before shelving,
 *              and that page is the entry's link. The owner admitted these on 2026-10-10 as
 *              first-party documentation: a NousResearch plugin with 4 stars is still the
 *              vendor's own, and the star floor was written for third-party repositories.
 *
 *   community  Only when the repository has a HERMES_REPOSITORIES record — a person read
 *              its documentation of Hermes support and wrote it down — and only rendered
 *              once the fetched star count clears the floor. On 2026-10-10 that is mem0
 *              (66,922); hindsight (47,831) and openviking (39,566) are not shelved. Nothing
 *              here waives the floor: the entry links to the plugin's own README inside the
 *              repository and carries `repo`, so archive.js applies the rule at render time.
 *
 * Catalogue presence alone is not a recommendation; the other 500-odd stay out.
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { serialise } from './json-format.mjs';
import { HERMES_REPOSITORIES } from '../assets/js/github-policy.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELF = join(ROOT, 'data', 'skills.json');
const RECORD = join(ROOT, 'scripts', 'imported-official-plugins.json');
const CATALOGUE = 'https://hermes-agent.nousresearch.com/docs/api/plugins.json';
const DOCS = 'https://hermes-agent.nousresearch.com/docs/plugins/';

const titleCase = name => name.split(/[-_]/)
  .map(w => ({ nvidia: 'NVIDIA', snyk: 'Snyk', sdk: 'SDK', directsdk: 'Direct SDK', mcp: 'MCP', ai: 'AI',
               homeassistant: 'Home Assistant', touchdesigner: 'TouchDesigner', mem0: 'Mem0', omh: 'OMH' })[w.toLowerCase()]
         ?? (/[A-Z]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

const sameLink = url => String(url || '').split('#')[0].replace(/\/$/, '').toLowerCase();
const repoSlug = url => (String(url || '').match(/github\.com\/([^/]+\/[^/#?]+)/) || [])[1]?.toLowerCase() || null;

async function resolves(url) {
  const head = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (head?.ok) return true;
  const get = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(25000) }).catch(() => null);
  return !!get?.ok;
}

async function pooled(items, width, work) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(width, queue.length) }, async () => {
    while (queue.length) await work(queue.shift());
  }));
}

/** What a reader needs before installing, in the order they need it. Official wording. */
function facts(p) {
  const out = [];
  if (p.requiresHermes) out.push(`Requires Hermes ${p.requiresHermes}.`);
  if (p.platforms?.length) out.push(`Platforms: ${p.platforms.join(', ')}.`);
  const caps = p.capabilities || {};
  if (caps.providesTools?.length) out.push(`Tools: ${caps.providesTools.join(', ')}.`);
  if (caps.requiresEnv?.length) out.push(`Environment: ${caps.requiresEnv.join(', ')}.`);
  if (p.version) out.push(`Version ${p.version} at import.`);
  return out.join(' ');
}

export function officialEntry(p, verifiedAt) {
  return {
    id: `plugin-official-${p.name}`,
    title: titleCase(p.name.replace(/^hermes-/, '')),
    summary: p.description,
    detail: [p.description, facts(p)].filter(Boolean).join('\n\n'),
    snippet: p.installCommand,
    tags: ['skills', 'plugin', 'official-plugin', p.category].filter(Boolean),
    source: 'docs',
    author: 'Nous Research',
    url: DOCS + p.name,
    verifiedAt
  };
}

export function communityEntry(p, verifiedAt) {
  const repo = repoSlug(p.repo);
  return {
    id: `plugin-community-${p.name}`,
    title: titleCase(p.name),
    summary: p.description,
    detail: [p.description, facts(p),
      `Maintained by ${p.maintainer} and installed into Hermes from the official plugin catalogue.`].filter(Boolean).join('\n\n'),
    snippet: p.installCommand,
    tags: ['skills', 'plugin', 'community-plugin', p.category].filter(Boolean),
    source: 'github',
    repo,
    author: p.maintainer,
    /* The plugin's own README inside the repository, never the repo root: the root is
       the product, and this card is about its Hermes plugin. */
    url: p.docsUrl || p.repo,
    verifiedAt
  };
}

async function main() {
  const dry = process.argv.includes('--dry');
  const verifiedAt = new Date().toISOString().slice(0, 10);

  const res = await fetch(CATALOGUE, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${CATALOGUE} — ${res.status}. The shelf is untouched.`);
  const all = await res.json();

  const official = all.filter(p => p.tier === 'official' && p.name && p.description && p.installCommand);
  const documented = all.filter(p => p.tier !== 'official' && p.name && p.description && p.installCommand
    && repoSlug(p.repo) && Object.hasOwn(HERMES_REPOSITORIES, repoSlug(p.repo)));

  const original = await readFile(SHELF, 'utf8');
  const shelf = JSON.parse(original);
  const items = shelf.items;
  const haveId = new Set(items.map(i => i.id));
  const haveLink = new Set(items.map(i => sameLink(i.url)));
  const haveTitle = new Set(items.map(i => (i.title || '').trim().toLowerCase()));

  const fresh = [], already = [];
  for (const [list, build] of [[official, officialEntry], [documented, communityEntry]]) {
    for (const p of list) {
      const e = build(p, verifiedAt);
      if (haveId.has(e.id) || haveLink.has(sameLink(e.url)) || haveTitle.has(e.title.toLowerCase())) { already.push(e.title); continue; }
      haveId.add(e.id); haveLink.add(sameLink(e.url)); haveTitle.add(e.title.toLowerCase());
      fresh.push(e);
    }
  }

  console.log(`catalogue: ${all.length} plugins — ${official.length} official, ${documented.length} community with documented Hermes support`);
  console.log(`  already on the shelf : ${already.length}`);
  console.log(`  new                  : ${fresh.length}`);

  const dead = [];
  await pooled(fresh, 6, async e => { if (!await resolves(e.url)) dead.push(e); });
  const keep = fresh.filter(e => !dead.includes(e));
  console.log(`  links verified       : ${keep.length}${dead.length ? `, ${dead.length} dead and dropped` : ''}`);
  for (const e of dead) console.log(`      dropped ${e.title} — ${e.url}`);

  if (dry) { console.log('\n--dry: nothing written.'); return; }
  if (!keep.length) { console.log('\nnothing new to add; the shelf is untouched.'); return; }

  shelf.items = [...items, ...keep];
  await writeFile(`${SHELF}.tmp`, serialise(original, shelf));
  await rename(`${SHELF}.tmp`, SHELF);

  await mkdir(dirname(RECORD), { recursive: true });
  let record = { source: CATALOGUE, passes: [] };
  try { record = JSON.parse(await readFile(RECORD, 'utf8')); record.passes ??= []; } catch { /* first run */ }
  record.note = 'Official Nous Research plugins shelved as first-party documentation (owner decision 2026-10-10), '
    + 'and community plugins whose repository has a HERMES_REPOSITORIES record, rendered only above the star floor. '
    + 'Every link verified to resolve at import. Catalogue presence alone is not a recommendation.';
  record.passes.push({ importedAt: new Date().toISOString(), counts: { catalogue: all.length, official: official.length, documented: documented.length, imported: keep.length, alreadyPresent: already.length, deadLinks: dead.length }, imported: keep.map(e => ({ id: e.id, title: e.title, url: e.url })) });
  record.totalImported = record.passes.reduce((n, p) => n + p.imported.length, 0);
  await writeFile(RECORD, JSON.stringify(record, null, 2) + '\n');

  console.log(`\nadded ${keep.length} to data/skills.json (${items.length} → ${items.length + keep.length})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
