#!/usr/bin/env node
/**
 * Refuse a deploy whose file list is wrong, before anything is uploaded.
 *
 * AGENTS.md: "run `vercel deploy --dry --json` and verify every runtime asset and configured
 * JSON file is included" — a `.vercelignore` line ending in `/` once shipped a site with no
 * data. This is that rule as code, so an unattended deploy applies it too. It also fails if a
 * script, secret or research file would ship. Reads the dry-run JSON on stdin.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function required(root = ROOT) {
  const index = JSON.parse(await readFile(join(root, 'data', 'index.json'), 'utf8'));
  const files = ['index.html', 'robots.txt', 'sitemap.xml', 'feed.xml', 'whats-new.html', 'vercel.json',
    'assets/css/style.css', 'assets/css/doc.css', 'assets/js/app.js',
    'data/index.json', 'data/live.json', 'data/rankings.json', 'data/added.json',
    ...index.sections.filter(s => s.file).map(s => `data/${s.file}`)];
  const entries = (await readdir(join(root, 'entry')).catch(() => [])).filter(f => f.endsWith('.html')).length;
  return { files, entries };
}

export function problemsIn(list, need) {
  const have = new Set(list);
  const problems = need.files.filter(f => !have.has(f)).map(f => `missing: ${f}`);
  const entries = list.filter(f => f.startsWith('entry/')).length;
  if (entries !== need.entries) problems.push(`entry pages: ${entries} would ship, ${need.entries} in the checkout`);
  for (const f of list) if (/^(scripts|desktop-plugin|docs|data\/research)\/|(^|\/)\.env|package\.json$/.test(f)) problems.push(`must not ship: ${f}`);
  return problems;
}

async function main() {
  let raw = ''; for await (const chunk of process.stdin) raw += chunk;
  const start = raw.indexOf('{'); const dry = JSON.parse(raw.slice(start));
  const list = (dry.files || dry.included || []).map(x => typeof x === 'string' ? x : x.file || x.path);
  const problems = problemsIn(list, await required());
  if (problems.length) { console.error(`✗ deploy refused:\n  ${problems.slice(0, 20).join('\n  ')}`); process.exitCode = 1; return; }
  console.log(`✓ ${list.length} files would ship; every runtime file present, nothing private included`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
