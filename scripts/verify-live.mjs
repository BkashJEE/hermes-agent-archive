#!/usr/bin/env node
/**
 * Does the live site serve what this checkout says it should?
 *
 *   node scripts/verify-live.mjs                      # the production domain
 *   node scripts/verify-live.mjs https://other.host   # any deployment you can reach
 *
 * The check an unattended deploy runs after promoting, and the reason it can roll back:
 * every shelf file present with the same number of entries as the checkout, the sitemap
 * listing the same number of urls, and the discovery surfaces answering. A CDN can lag a
 * promotion by seconds, so each check retries before it fails.
 *
 * It cannot see a JavaScript error in a browser — the Dashboard crash of 2026-10-10 served
 * every file correctly. That class is caught before deploy by `npm run check` and the
 * tests, which now reject the data shape that caused it.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function expectations(root = ROOT) {
  const index = JSON.parse(await readFile(join(root, 'data', 'index.json'), 'utf8'));
  const shelves = {};
  for (const s of index.sections) if (s.file)
    shelves[s.file] = JSON.parse(await readFile(join(root, 'data', s.file), 'utf8')).items.length;
  const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8').catch(() => '');
  const entries = (await readdir(join(root, 'entry')).catch(() => [])).filter(f => f.endsWith('.html'));
  return { shelves, sitemapUrls: (sitemap.match(/<loc>/g) || []).length, sampleEntry: entries[0]?.replace(/\.html$/, '') };
}

export async function verify(site, want, { fetcher = fetch, attempts = 6, waitMs = 10000, log = console.log } = {}) {
  const get = async path => {
    const res = await fetcher(`${site}/${path}`, { signal: AbortSignal.timeout(20000), headers: { 'cache-control': 'no-cache' } });
    return { status: res.status, text: res.ok ? await res.text() : '' };
  };
  const problems = [];
  const check = async (label, fn) => {
    for (let i = 1; i <= attempts; i++) {
      const why = await fn().catch(e => e.message);
      if (!why) return;
      if (i === attempts) { problems.push(`${label}: ${why}`); return; }
      await new Promise(r => setTimeout(r, waitMs));
    }
  };
  for (const [file, n] of Object.entries(want.shelves))
    await check(`data/${file}`, async () => {
      const r = await get(`data/${file}`);
      if (r.status !== 200) return `HTTP ${r.status}`;
      const got = JSON.parse(r.text).items?.length;
      return got === n ? null : `${got} entries live, ${n} in the checkout`;
    });
  await check('sitemap.xml', async () => {
    const r = await get('sitemap.xml');
    if (r.status !== 200) return `HTTP ${r.status}`;
    const got = (r.text.match(/<loc>/g) || []).length;
    return got === want.sitemapUrls ? null : `${got} urls live, ${want.sitemapUrls} in the checkout`;
  });
  for (const path of ['', 'robots.txt', 'feed.xml', 'whats-new', ...(want.sampleEntry ? [`entry/${want.sampleEntry}`] : [])])
    await check(`/${path}`, async () => { const r = await get(path); return r.status === 200 ? null : `HTTP ${r.status}`; });
  if (problems.length) log(`✗ ${problems.length} check(s) failed:\n  ${problems.join('\n  ')}`);
  else log(`✓ ${site} serves ${Object.keys(want.shelves).length} shelves, ${Object.values(want.shelves).reduce((a, b) => a + b, 0)} entries and ${want.sitemapUrls} sitemap urls, matching the checkout`);
  return problems;
}

async function main() {
  const site = (process.argv[2] || 'https://hermes-agent-archive.vercel.app').replace(/\/$/, '');
  const problems = await verify(site, await expectations());
  if (problems.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
