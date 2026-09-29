#!/usr/bin/env node
// Import the owner's reviewed manifest, never unreviewed issue bodies or model output.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { communityException, hermesSupport } from '../assets/js/github-policy.js';
import { githubRepo } from '../assets/js/archive.js';
import { serialise } from './json-format.mjs';

export function mergeSubmissions(archive, manifest) {
  if (!Array.isArray(archive.items) || !Array.isArray(manifest.items) || !manifest.items.length)
    throw new Error('Expected a nonempty reviewed manifest and a valid archive; existing data is untouched.');
  const ids = new Set(), titles = new Set();
  for (const item of manifest.items) {
    const repo = githubRepo(item);
    for (const field of ['id', 'title', 'summary', 'detail', 'author', 'url'])
      if (typeof item[field] !== 'string' || !item[field].trim()) throw new Error(`Missing ${field}`);
    if (item.source !== 'github' || !communityException(repo) || !hermesSupport(repo) ||
        item.url.toLowerCase() !== `https://github.com/${repo}`)
      throw new Error(`Unapproved repository or source URL: ${item.id}`);
    if (item.metric || item.metric2 || item.credit) throw new Error('Metrics belong to the public API fetcher');
    const title = item.title.toLowerCase();
    if (ids.has(item.id) || titles.has(title)) throw new Error('Duplicate manifest id or title');
    ids.add(item.id); titles.add(title);
  }
  const result = structuredClone(archive);
  for (const item of manifest.items) {
    const existing = result.items.find(x => x.id === item.id);
    if (existing) {
      if (existing.url !== item.url) throw new Error(`Existing id points to another source: ${item.id}`);
      continue; // Keep archived wording; reruns never overwrite reviewed entries.
    }
    if (result.items.some(x => x.title.toLowerCase() === item.title.toLowerCase() || x.url === item.url))
      throw new Error(`Duplicate archived title or URL: ${item.id}`);
    result.items.push(structuredClone(item));
  }
  return result;
}

export async function importSubmissions(root = new URL('../', import.meta.url)) {
  const target = new URL('data/builds.json', root);
  const original = await readFile(target, 'utf8');
  const manifest = JSON.parse(await readFile(new URL('scripts/community-submissions.json', root), 'utf8'));
  const next = serialise(original, mergeSubmissions(JSON.parse(original), manifest));
  if (next === original) return false;
  await writeFile(new URL('data/builds.json.tmp', root), next);
  await rename(new URL('data/builds.json.tmp', root), target);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importSubmissions().then(changed => console.log(changed ? 'Imported reviewed community submissions.' : 'All submissions already archived; unchanged.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
