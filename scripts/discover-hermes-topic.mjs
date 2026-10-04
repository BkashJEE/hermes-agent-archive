#!/usr/bin/env node
/**
 * Turn the `hermes-agent` GitHub topic into a queue of reviewable candidates.
 *
 *   node scripts/discover-hermes-topic.mjs          # top 100 by stars
 *   node scripts/discover-hermes-topic.mjs --pages 5
 *   node scripts/discover-hermes-topic.mjs --dry
 *
 * Nearly four thousand repositories carry the topic and twenty-three have ever been
 * reviewed. Nothing stood between those two numbers, so the ecosystem that grew around
 * Hermes stayed invisible unless somebody happened to see a post about it.
 *
 * This writes candidates, never entries. The topic is self-assigned: anyone can tag a
 * repository `hermes-agent`, so it says what an author claims, not what is true. Admission
 * still requires what HERMES_REPOSITORIES already demands — a documented integration, read
 * by a person, recorded with a URL and a date. What this removes is the part that was
 * genuinely missing: knowing which repositories are worth that reading.
 *
 * To help with the reading, each candidate carries the lines of its own README that
 * mention Hermes, quoted. That is evidence to assess, not a verdict.
 */

import './env.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { HERMES_REPOSITORIES, COMMUNITY_EXCEPTIONS } from '../assets/js/github-policy.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'research', 'hermes-topic-candidates.json');
const TOPIC = 'hermes-agent';

const token = process.env.GITHUB_TOKEN;
const headers = {
  'user-agent': 'hermes-agent-archive/1.0',
  accept: 'application/vnd.github+json',
  ...(token ? { authorization: `Bearer ${token}` } : {})
};

async function api(url) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (res.status === 403 || res.status === 429)
    throw new Error('GitHub rate limit reached. Set GITHUB_TOKEN; existing candidates are untouched.');
  if (!res.ok) throw new Error(`${url} — ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Does Hermes appear in the words of this line, rather than in its markup?
 *
 * A README badge or screenshot can carry `hermes` in an image filename or an alt
 * attribute while the sentence a reader sees never mentions it. Those lines read as
 * evidence of an integration and are evidence of a file name. One repository ranked sixth
 * in review order on two `<img>` tags, so markup is stripped before the test.
 *
 * Code is deliberately kept. `~/.hermes/skills/` or `hermes skills tap add` is the
 * strongest evidence of a real integration a README can contain — removing it to tidy the
 * filter would throw away the thing worth finding.
 */
export function mentionsHermesInProse(line) {
  const visible = line
    /* Real tags only. Anything in angle brackets is too greedy: a usage line like
       `import <hermes|openclaw|codex>` is prose, and eating it loses an integration. A tag
       name is followed by whitespace, a slash or the closing bracket — never a pipe. */
    .replace(/<\/?[a-z][a-z0-9-]*(\s[^>]*)?\/?>/gi, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')      // links keep their label, drop the target
    .replace(/^[#>\-*|\s]+/, '');                   // leading markdown furniture
  return /hermes/i.test(visible) && visible.trim().length > 12;
}

/**
 * The lines of a README that mention Hermes, as the author wrote them.
 *
 * A repository tagged `hermes-agent` whose README never says Hermes is almost certainly
 * mis-tagged, and one that says it fifteen times is worth a look first. Neither fact
 * admits anything; both save a reviewer from opening forty tabs.
 */
async function hermesMentions(repo, branch) {
  for (const name of ['README.md', 'readme.md', 'README.MD']) {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${name}`;
    const res = await fetch(url, { headers: { 'user-agent': headers['user-agent'] }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!res?.ok) continue;
    const text = await res.text();
    const lines = text.split('\n').map(line => line.trim()).filter(mentionsHermesInProse);
    return { count: lines.length, quoted: lines.slice(0, 6), readme: url };
  }
  return { count: 0, quoted: [], readme: null };
}

/** Everything the archive already knows about, so the queue holds only new work. */
async function alreadyKnown() {
  const known = new Set([
    ...Object.keys(HERMES_REPOSITORIES),
    ...Object.keys(COMMUNITY_EXCEPTIONS)
  ].map(r => r.toLowerCase()));

  const index = JSON.parse(await readFile(join(ROOT, 'data', 'index.json'), 'utf8'));
  for (const section of index.sections) {
    if (!section.file) continue;
    const raw = JSON.parse(await readFile(join(ROOT, 'data', section.file), 'utf8'));
    for (const item of (Array.isArray(raw) ? raw : raw.items)) {
      const link = item.repo || (item.url?.includes('github.com/') ? item.url.split('github.com/')[1] : null);
      const repo = link?.split('/').slice(0, 2).join('/');
      if (repo) known.add(repo.toLowerCase());
    }
  }
  return known;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const pagesArg = process.argv.indexOf('--pages');
  const pages = pagesArg > -1 ? Math.max(1, Math.min(10, Number(process.argv[pagesArg + 1]) || 1)) : 1;

  const known = await alreadyKnown();
  const candidates = [];
  let total = 0, seen = 0;

  for (let page = 1; page <= pages; page++) {
    const data = await api(`https://api.github.com/search/repositories?q=topic:${TOPIC}&sort=stars&order=desc&per_page=100&page=${page}`);
    total = data.total_count;
    for (const repo of data.items || []) {
      seen++;
      const full = repo.full_name.toLowerCase();
      if (known.has(full)) continue;
      /* Archived and forked repositories are noise in a queue meant for live work. */
      if (repo.archived || repo.fork) continue;
      candidates.push({
        repo: repo.full_name,
        stars: repo.stargazers_count,
        description: repo.description || null,
        topics: repo.topics || [],
        pushedAt: repo.pushed_at,
        url: repo.html_url,
        defaultBranch: repo.default_branch
      });
    }
  }

  /* Read the READMEs of the strongest candidates only: a reviewer works down from the
     top, and four thousand fetches to fill a file nobody reads to the end is waste. */
  for (const candidate of candidates.slice(0, 40)) {
    candidate.evidence = await hermesMentions(candidate.repo, candidate.defaultBranch);
    delete candidate.defaultBranch;
  }
  for (const candidate of candidates) delete candidate.defaultBranch;

  const withEvidence = candidates.filter(c => c.evidence?.count);
  const looksMistagged = candidates.filter(c => c.evidence && !c.evidence.count);

  console.log(`topic:${TOPIC} — ${total} repositories, ${seen} read, ${known.size} already known`);
  console.log(`${candidates.length} new candidates; READMEs read for the top ${Math.min(40, candidates.length)}`);
  console.log(`  mention Hermes in their README : ${withEvidence.length}`);
  console.log(`  no mention, likely mis-tagged  : ${looksMistagged.length}`);
  console.log('\ntop candidates by stars:');
  for (const c of candidates.slice(0, 12))
    console.log(`  ${String(c.stars).padStart(7)}  ${c.repo.padEnd(40)} ${c.evidence ? `${c.evidence.count} mentions` : ''}`);

  if (dry) { console.log('\n--dry: nothing written.'); return; }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    topic: TOPIC,
    totalInTopic: total,
    note: 'Candidates for review, not entries. The topic is self-assigned and proves nothing. '
        + 'Admission still requires a documented Hermes integration read by a person and recorded '
        + 'in HERMES_REPOSITORIES with a URL and a date, exactly as before.',
    candidates
  }, null, 2) + '\n');
  console.log(`\nwrote ${OUT.replace(ROOT + '/', '')} — review before anything reaches a shelf.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
