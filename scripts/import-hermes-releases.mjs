#!/usr/bin/env node
/**
 * Shelve every Hermes Agent release, linked to its notes.
 *
 *   npm run releases          # fetch releases, merge new or edited ones by id
 *   npm run releases -- --dry # report, write nothing
 *
 * A reader of a Hermes archive wants to know what changed in Hermes, and nothing here said.
 * Nous publishes a GitHub release roughly weekly with substantive notes, which makes it the
 * most regular official source the archive has — and the one most likely to give the daily
 * harvest something real on a day the other sources are quiet.
 *
 * One card per release, never one per bullet: a bullet out of its release is the fragment
 * problem again. The card quotes the opening of the notes and links to the full text.
 * Drafts and prereleases are skipped. Merges by id; an edited release is refreshed; nothing
 * is removed; an unchanged upstream leaves the file byte-identical.
 */

import './env.mjs';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { serialise } from './json-format.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELF = join(ROOT, 'data', 'releases.json');
const API = 'https://api.github.com/repos/NousResearch/hermes-agent/releases';
const DETAIL_CHARS = 1600;

/** Markdown notes as the plain paragraphs the drawer renders. Backticks stay: they mark config keys. */
export function plainNotes(body) {
  return String(body || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.replace(/^#{1,6}\s+/, '').replace(/^>\s?/, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^\s*[-*]\s+/, '• ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The first sentence-bearing paragraph: not the title, not the date line. */
export function summaryOf(body, name) {
  const paras = plainNotes(body).split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const pick = paras.find(p => p !== name && !/^Release Date:/i.test(p) && p.length > 40) || paras[0] || name;
  return pick.length <= 220 ? pick : pick.slice(0, pick.lastIndexOf(' ', 217)) + '…';
}

/** The opening of the notes, cut at a paragraph boundary. The title and the release-date
    line are dropped: the card header already carries both, and repeating them pushed the
    actual notes below the fold in the drawer. */
export function detailOf(body, url, name = '') {
  const text = plainNotes(body).split(/\n\s*\n/)
    .filter((p, i) => !(i < 3 && (p.trim() === name.trim() || /^Release Date:/i.test(p.trim()))))
    .join('\n\n');
  let out = text;
  if (text.length > DETAIL_CHARS) {
    const cut = text.lastIndexOf('\n\n', DETAIL_CHARS);
    out = text.slice(0, cut > 400 ? cut : DETAIL_CHARS).trim() + '\n\n…';
  }
  return `${out}\n\nFull release notes: ${url}`;
}

export const releaseId = tag => `release-${String(tag).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

export function entryFor(r) {
  const name = (r.name || r.tag_name).trim();
  return {
    id: releaseId(r.tag_name),
    title: name,
    summary: summaryOf(r.body, name),
    detail: detailOf(r.body, r.html_url, name),
    tags: ['release'],
    source: 'github',
    author: 'Nous Research',
    url: r.html_url,
    date: String(r.published_at || r.created_at).slice(0, 10)
  };
}

async function fetchAll() {
  const headers = { 'user-agent': 'hermes-agent-archive/1.0', accept: 'application/vnd.github+json',
    ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${API}?per_page=100&page=${page}`, { headers, signal: AbortSignal.timeout(30000) });
    if (res.status === 401 || res.status === 403) throw new Error(`GitHub refused (${res.status}). The shelf is untouched.`);
    if (!res.ok) throw new Error(`${API} — ${res.status}. The shelf is untouched.`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter(r => !r.draft && !r.prerelease && r.tag_name && r.html_url);
}

async function main() {
  const dry = process.argv.includes('--dry');
  const releases = await fetchAll();
  if (!releases.length) throw new Error('GitHub returned no releases — refusing to treat that as "none exist". The shelf is untouched.');

  const original = await readFile(SHELF, 'utf8').catch(() => null);
  const shelf = original ? JSON.parse(original) : {
    note: 'Imported from the NousResearch/hermes-agent GitHub releases by scripts/import-hermes-releases.mjs. One card per published release; the summary and detail are the opening of the official notes, linked in full. Entries are merged, never replaced.',
    items: []
  };
  const byId = new Map(shelf.items.map(i => [i.id, i]));
  let added = 0, refreshed = 0;
  for (const r of releases) {
    const e = entryFor(r);
    const before = byId.get(e.id);
    if (!before) { byId.set(e.id, e); added++; }
    else if (JSON.stringify(before) !== JSON.stringify({ ...before, ...e })) { byId.set(e.id, { ...before, ...e }); refreshed++; }
  }
  /* Newest first in the file; the shelf itself orders by the site's ranking rules. */
  const items = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  console.log(`${releases.length} published releases · ${added} new · ${refreshed} edited upstream · ${items.length} on the shelf`);
  if (dry) { console.log('--dry: nothing written.'); return; }
  if (!added && !refreshed && original) { console.log('Nothing changed upstream; the file is left exactly as it was.'); return; }
  shelf.items = items;
  const next = original ? serialise(original, shelf) : JSON.stringify(shelf, null, 2) + '\n';
  await writeFile(`${SHELF}.tmp`, next);
  await rename(`${SHELF}.tmp`, SHELF);
  console.log('wrote data/releases.json');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
