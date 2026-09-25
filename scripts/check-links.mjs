#!/usr/bin/env node
/**
 * Audit every source link in the archive.
 *
 *   node scripts/check-links.mjs           # attribution + docs anchors (no third-party calls)
 *   node scripts/check-links.mjs --github  # additionally confirm each GitHub repo resolves
 *
 * The archive's promise is that every entry links to its source and credits its author.
 * That promise is checkable, and until now nothing checked it. Three CLI entries pointed
 * at headings that do not exist, so the reader landed at the top of a 91-heading
 * reference page and had to hunt.
 *
 * Two things are verified here:
 *
 *   attribution — every entry has a reachable link, and third-party work names whose
 *                 work it is. Official documentation is exempt: the source label already
 *                 says Nous Research, and inventing a person for it would be worse.
 *
 *   docs anchors — every link into the Hermes documentation that names a heading must
 *                 name one the page actually has.
 *
 * X, Reddit and Discord are deliberately not fetched. They refuse anonymous reads, so a
 * request would report a live permalink as dead and invite someone to "fix" a good link.
 * Silence there is honest; a false red is not.
 */

import './env.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_HOST = 'hermes-agent.nousresearch.com';
const CHECK_GITHUB = process.argv.includes('--github');

/** A GitHub entry stores `repo`; everything else stores `url`. Both are a source link. */
export const sourceLink = item => item.url || (item.repo ? `https://github.com/${item.repo}` : null);

const index = JSON.parse(await readFile(join(ROOT, 'data', 'index.json'), 'utf8'));
const items = [];
for (const section of index.sections) {
  if (!section.file) continue;                 // dashboard and trending are computed
  const raw = JSON.parse(await readFile(join(ROOT, 'data', section.file), 'utf8'));
  for (const item of (Array.isArray(raw) ? raw : raw.items)) items.push({ ...item, shelf: section.id });
}

const problems = [];

/* ---- attribution ---- */
for (const item of items) {
  const link = sourceLink(item);
  if (!link) { problems.push(['no-source', item.shelf, item.id, 'entry has neither url nor repo']); continue; }
  if (!/^https?:\/\//.test(link)) problems.push(['bad-source', item.shelf, item.id, link]);
  if (item.source !== 'docs' && !item.author && !item.credit)
    problems.push(['no-author', item.shelf, item.id, "third-party entry names no author"]);
}

/* ---- documentation anchors ---- */
const anchored = items.filter(i => (sourceLink(i) || '').includes(DOCS_HOST) && sourceLink(i).includes('#'));
const pages = [...new Set(anchored.map(i => sourceLink(i).split('#')[0]))];
const anchorsByPage = new Map();

for (const page of pages) {
  try {
    const res = await fetch(page, { headers: { 'user-agent': 'hermes-agent-archive/1.0' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const html = await res.text();
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    if (!ids.size) throw new Error('no ids parsed — page markup changed');
    anchorsByPage.set(page, ids);
  } catch (error) {
    /* Unreachable is not the same as broken: say so and do not blame the entries. */
    problems.push(['page-unreachable', '—', page.replace(`https://${DOCS_HOST}/docs/`, ''), error.message]);
  }
}

for (const item of anchored) {
  const [page, anchor] = sourceLink(item).split('#');
  const ids = anchorsByPage.get(page);
  if (ids && !ids.has(anchor)) problems.push(['dead-anchor', item.shelf, item.id, `#${anchor}`]);
}

/* ---- GitHub repositories, only when asked ---- */
let repoChecked = 0;
if (CHECK_GITHUB) {
  const token = process.env.GITHUB_TOKEN;
  /* gist.github.com also ends in github.com, but a gist is not a repository: asking
     /repos for one 404s and would report four live permalinks as dead. Each host gets
     the endpoint that actually describes it. */
  const targets = [...new Set(items.map(sourceLink).filter(Boolean)
    .filter(l => /^https:\/\/(gist\.)?github\.com\//.test(l))
    .map(l => l.startsWith('https://gist.github.com/')
      ? { kind: 'gist', id: l.split('gist.github.com/')[1].split('/').filter(Boolean).pop() }
      : { kind: 'repo', id: l.split('github.com/')[1].split('/').slice(0, 2).join('/') })
    .filter(t => t.id && (t.kind === 'gist' || t.id.split('/').length === 2))
    .map(t => `${t.kind}:${t.id}`))].map(s => ({ kind: s.split(':')[0], id: s.slice(s.indexOf(':') + 1) }));

  for (const { kind, id } of targets) {
    const api = kind === 'gist' ? `https://api.github.com/gists/${id}` : `https://api.github.com/repos/${id}`;
    const res = await fetch(api, {
      headers: { 'user-agent': 'hermes-agent-archive/1.0', accept: 'application/vnd.github+json',
                 ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20000)
    });
    if (res.status === 403 || res.status === 429) {
      problems.push(['github-rate-limited', '—', id, 'stopped rather than guess; set GITHUB_TOKEN']);
      break;                                   // never turn a rate limit into a wall of false failures
    }
    if (res.status === 404) problems.push([kind === 'gist' ? 'gist-missing' : 'repo-missing', '—', id, '404']);
    repoChecked++;
  }
}

const byKind = problems.reduce((m, [kind]) => (m[kind] = (m[kind] || 0) + 1, m), {});
for (const [kind, shelf, id, detail] of problems) console.log(`${kind.padEnd(19)} ${shelf.padEnd(11)} ${id}  ${detail}`);

console.log(`\n${items.length} entries · ${anchored.length} anchored docs links across ${pages.length} pages` +
            (CHECK_GITHUB ? ` · ${repoChecked} repositories and gists` : ' · repositories not checked (pass --github)'));
console.log(problems.length ? `${problems.length} problem(s): ${JSON.stringify(byKind)}` : 'Every entry links to its source and credits its author.');

if (problems.length) process.exit(1);
