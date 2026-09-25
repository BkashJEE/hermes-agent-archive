#!/usr/bin/env node
/**
 * Pull real public engagement numbers into data/live.json.
 *
 *   GitHub  — stars / forks / description for every repo seeded in data/builds.json
 *   HN      — top stories via the public Algolia search API
 *   Reddit  — top posts from the configured subreddits via the public .json endpoints
 *
 * Nothing here invents a number. Failed sources retain prior snapshots as stale;
 * authentication failures abort without writing.
 *
 *   node scripts/fetch-signals.mjs
 *   GITHUB_TOKEN=ghp_... node scripts/fetch-signals.mjs        # 60/hr -> 5000/hr
 *   REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=... node ...     # Reddit needs app-only OAuth
 *
 * X and Facebook have no free public API. Entries from those sources stay
 * hand-curated in the data/*.json files, with a real permalink.
 */

import './env.mjs';
import { MIN_GITHUB_STARS, HERMES_REPOSITORIES, hermesSupport } from '../assets/js/github-policy.js';
import { recordGithubObservations } from '../assets/js/trends.js';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CONFIG = {
  // GitHub *discovery*: finds projects nobody has seeded yet, the way a search feed does.
  discoverQuery: '"hermes-agent" in:name,description,readme',
  discoverMax: 60,
  discoverPages: 3,          // Up to 100 candidates per page
  hnQueries:  ['hermes agent', 'nous research hermes'],
  subreddits: ['NousResearch', 'HermesAgent'],
  redditWindow: 'month',   // hour | day | week | month | year | all
  perSource: 12,
  windowDays: 120,

  // Popularity floors. This archive is a "most viewed, most talked about" shelf,
  // so something nobody engaged with does not belong on it regardless of topic.
  // Override per run: MIN_STARS=100000 node scripts/fetch-signals.mjs
  // Jev judges relevance after the owner's minimum of more than 50,000 verified stars.
  minStars:         Math.max(MIN_GITHUB_STARS, Number(process.env.MIN_STARS ?? MIN_GITHUB_STARS)),
  minHnPoints:      Number(process.env.MIN_HN_POINTS     ?? 300),
  minRedditUpvotes: Number(process.env.MIN_REDDIT_UPVOTES ?? 200)
};

const UA = 'hermes-agent-archive/1.0 (+https://github.com/BkashJEE)';
const since = Math.floor((Date.now() - CONFIG.windowDays * 86400000) / 1000);
const warnings = [];

const TIMEOUT_MS = 15000;
const RETRY_STATUS = new Set([403, 429, 500, 502, 503]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* One retry on the statuses that mean "try again", not "this doesn't exist".
   A rate-limited request must not be mistaken for a repo that isn't there. */
async function json(url, headers = {}, attempt = 0) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow'
    });
    if (!res.ok) {
      const err = new Error(`${res.status} ${res.statusText || ''}`.trim());
      err.status = res.status;
      throw err;
    }
    return res.json();
  } catch (err) {
    if (url.startsWith('https://api.github.com/') && [401, 403].includes(err.status)) {
      err.fatal = true;
      throw err;
    }
    if (attempt < 1 && (RETRY_STATUS.has(err.status) || err.name === 'TimeoutError')) {
      await sleep(2500);
      return json(url, headers, attempt + 1);
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ GitHub */

async function github(repos) {
  const headers = { accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const out = [];
  for (const repo of repos) {
    try {
      const r = await json(`https://api.github.com/repos/${repo}`, headers);
      if (r.private) throw new Error('Repository is not public');
      out.push({
        repo: r.full_name,
        description: r.description || '',
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language || '',
        url: r.html_url,
        pushedAt: (r.pushed_at || '').slice(0, 10)
      });
      process.stdout.write(`  ✓ ${r.full_name} — ${r.stargazers_count.toLocaleString()} stars\n`);
    } catch (err) {
      if (err.fatal) throw err; // Abort before replacing any snapshot.
      warnings.push(`GitHub ${repo}: ${err.message}`);
      process.stdout.write(`  ✗ ${repo} — ${err.message}\n`);
    }
  }
  return out.sort((a, b) => b.stars - a.stars);
}

/* ------------------------------------------------------- GitHub discovery */

const SLUG = /^[\w.-]+\/[\w.-]+$/;

/* Search for projects that exist but nobody has curated yet. Mirrors the guards a
   search-backed feed needs: no forks, no archived, no dead repos, and a relevance
   re-check because GitHub's matcher is looser than the query implies. */
async function discover(seeded) {
  const headers = { accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  /* One page only ever showed the top slice of thousands of matches. */
  const pool = [];
  let total = 0, incomplete = false;
  for (let page = 1; page <= CONFIG.discoverPages; page++) {
    const params = new URLSearchParams({
      q: `${CONFIG.discoverQuery} fork:false archived:false is:public stars:>${CONFIG.minStars}`,
      sort: 'stars', order: 'desc', per_page: '100', page: String(page)
    });
    try {
      const data = await json(`https://api.github.com/search/repositories?${params}`, headers);
      total = data.total_count ?? total;
      incomplete ||= !!data.incomplete_results;
      const items = data.items || [];
      pool.push(...items);
      if (items.length < 100) break;              // no further pages
    } catch (err) {
      if (err.fatal) throw err; // Abort before replacing any snapshot.
      warnings.push(`GitHub discovery page ${page}: ${err.message}`);
      process.stdout.write(`  ✗ discovery page ${page} — ${err.message}\n`);
      break;
    }
  }
  if (!pool.length) return [];
  if (incomplete) warnings.push('GitHub returned an incomplete search result set.');
  const data = { items: pool, total_count: total };

  const seen = new Set(seeded.map(r => r.toLowerCase()));
  const out = [];
  let belowBar = 0;
  for (const r of data.items || []) {
    const name = r.full_name || '';
    const desc = r.description || '';
    const topics = Array.isArray(r.topics) ? r.topics : [];

    if (!SLUG.test(name) || seen.has(name.toLowerCase())) continue;
    if (r.private || r.fork || r.archived || r.disabled) continue;
    if (!Number.isFinite(r.stargazers_count) || r.stargazers_count <= CONFIG.minStars) { belowBar++; continue; }
    // A search mention is not integration evidence; review upstream docs first.
    if (!hermesSupport(name)) {
      process.stdout.write(`  · needs Hermes documentation review: ${name}\n`);
      continue;
    }

    seen.add(name.toLowerCase());
    out.push({
      repo: name,
      description: desc.slice(0, 600),
      stars: Math.floor(r.stargazers_count),
      forks: Math.floor(r.forks_count || 0),
      language: (r.language || '').slice(0, 50),
      topics: topics.slice(0, 8),
      url: `https://github.com/${name}`,
      pushedAt: (r.pushed_at || '').slice(0, 10),
      discovered: true
    });
    if (out.length >= CONFIG.discoverMax) break;
  }
  process.stdout.write(`  ✓ discovery — ${out.length} new projects kept, ${belowBar} below ${CONFIG.minStars.toLocaleString()} stars (${data.total_count ?? '?'} matched)\n`);
  return out;
}

/* ---------------------------------------------------------------------- HN */

async function hackernews() {
  const seen = new Map();
  for (const q of CONFIG.hnQueries) {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}`
              + `&tags=story&numericFilters=created_at_i>${since},points>=${CONFIG.minHnPoints}`
              + `&hitsPerPage=${CONFIG.perSource * 2}`;
    try {
      const { hits = [] } = await json(url);
      for (const h of hits) {
        if (seen.has(h.objectID)) continue;
        seen.set(h.objectID, {
          id: h.objectID,
          title: h.title,
          summary: `Discussed on Hacker News${h.url ? ` — ${new URL(h.url).hostname.replace(/^www\./, '')}` : ''}.`,
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          author: h.author ? `@${h.author}` : '',
          points: h.points || 0,
          comments: h.num_comments || 0,
          date: (h.created_at || '').slice(0, 10)
        });
      }
    } catch (err) {
      warnings.push(`Hacker News "${q}": ${err.message}`);
      process.stdout.write(`  ✗ hn "${q}" — ${err.message}\n`);
    }
  }
  const list = [...seen.values()].sort((a, b) => b.points - a.points).slice(0, CONFIG.perSource);
  process.stdout.write(`  ✓ hacker news — ${list.length} stories\n`);
  return list;
}

/* ------------------------------------------------------------------ Reddit */

/* Reddit's anonymous .json endpoints are blocked for many networks and redirect to a
   login page. The supported way is application-only OAuth with a free "script" app:
   https://www.reddit.com/prefs/apps  ->  set REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET.
   Without credentials we try anonymously once and report honestly if it's refused. */
async function redditToken() {
  const id = process.env.REDDIT_CLIENT_ID, secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': UA
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`token ${res.status} ${res.statusText}`);
  return (await res.json()).access_token;
}

async function reddit() {
  let token = null;
  try {
    token = await redditToken();
  } catch (err) {
    warnings.push(`Reddit auth: ${err.message}`);
    process.stdout.write(`  ✗ auth — ${err.message}\n`);
  }
  if (!token) process.stdout.write('  · no REDDIT_CLIENT_ID/SECRET — trying anonymously\n');

  const host = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const auth = token ? { authorization: `Bearer ${token}` } : {};

  const out = [];
  for (const sub of CONFIG.subreddits) {
    const url = `${host}/r/${sub}/top${token ? '' : '.json'}?t=${CONFIG.redditWindow}&limit=${CONFIG.perSource * 2}`;
    try {
      const data = await json(url, auth);
      const children = data?.data?.children;
      if (!Array.isArray(children)) throw new Error('not a listing (anonymous access refused)');
      for (const { data: p } of children) {
        if (p.stickied || p.over_18 || p.ups < CONFIG.minRedditUpvotes) continue;
        out.push({
          id: p.id,
          title: p.title,
          summary: (p.selftext || '').replace(/\s+/g, ' ').slice(0, 200).trim()
                   || `Top post in r/${p.subreddit} this ${CONFIG.redditWindow}.`,
          url: `https://www.reddit.com${p.permalink}`,
          author: p.author ? `u/${p.author}` : '',
          subreddit: p.subreddit,
          upvotes: p.ups,
          comments: p.num_comments,
          date: new Date(p.created_utc * 1000).toISOString().slice(0, 10)
        });
      }
      process.stdout.write(`  ✓ r/${sub}\n`);
    } catch (err) {
      warnings.push(`Reddit r/${sub}: ${err.message}${token ? '' : ' — set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET (free script app at reddit.com/prefs/apps)'}`);
      process.stdout.write(`  ✗ r/${sub} — ${err.message}\n`);
    }
  }
  return out.sort((a, b) => b.upvotes - a.upvotes).slice(0, CONFIG.perSource);
}

/* -------------------------------------------------------------------- main */

const index = JSON.parse(await readFile(join(ROOT, 'data/index.json'), 'utf8'));
const repos = Object.keys(HERMES_REPOSITORIES);
for (const section of index.sections) {
  if (!section.file) continue;           // a computed section has nothing on disk
  const { items } = JSON.parse(await readFile(join(ROOT, 'data', section.file), 'utf8'));
  for (const item of items) if (item.repo && hermesSupport(item.repo) && !repos.includes(item.repo.toLowerCase())) repos.push(item.repo.toLowerCase());
}

console.log(`\nGitHub (${repos.length} seeded repos)${process.env.GITHUB_TOKEN ? ` · authenticated via ${process.env.GITHUB_TOKEN_SOURCE || 'GITHUB_TOKEN'}` : ' · unauthenticated, 60 requests/hour'}`);
const seededData = await github(repos);
console.log('\nGitHub discovery');
const found = await discover(repos);
const gh = [...seededData, ...found].sort((a, b) => b.stars - a.stars);
console.log('\nHacker News');
const hn = await hackernews();
console.log('\nReddit');
const rd = await reddit();

/* Nothing is ever dropped because one run failed. A repo that 403s keeps the
   figure from the last successful fetch, flagged stale so the page can say so. */
const previous = JSON.parse(await readFile(join(ROOT, 'data/live.json'), 'utf8').catch(() => '{}'));
const merge = (fresh, old, key) => {
  const out = new Map((old || []).map(x => [x[key], { ...x, stale: true }]));
  for (const item of fresh) out.set(item[key], { ...item, stale: false });
  return [...out.values()];
};

const observedAt = new Date().toISOString();
const measured = recordGithubObservations(gh, previous, observedAt);
const mergedRepos = merge(measured, previous.github, 'repo').sort((a, b) => b.stars - a.stars);
const keptStale = mergedRepos.filter(g => g.stale).length;
if (keptStale) console.log(`\n${keptStale} repo(s) kept from the previous fetch rather than dropped.`);

const payload = {
  generatedAt: observedAt,
  note: 'Generated by scripts/fetch-signals.mjs from public APIs. Entries are merged, never replaced: a source that fails keeps its last known value, marked stale. Do not hand-edit.',
  warnings,
  github: mergedRepos,
  hn:     hn.length ? hn : (previous.hn || []),
  reddit: rd.length ? rd : (previous.reddit || []),
  routed: previous.routed,
  routedAt: previous.routedAt,
  routedBy: previous.routedBy
};

await writeFile(join(ROOT, 'data/live.json'), JSON.stringify(payload, null, 2) + '\n');

console.log(`\nWrote data/live.json — ${gh.length} repos (${seededData.length} seeded + ${found.length} discovered), ${hn.length} HN stories, ${rd.length} Reddit posts.`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  · ${w}`);
  console.log('\nUnavailable sources retain their previous snapshots; no estimates were added.');
}
