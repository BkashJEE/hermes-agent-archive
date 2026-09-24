#!/usr/bin/env node
/**
 * Route fetched signals into the archive's sections.
 *
 * Everything scripts/fetch-signals.mjs pulls lands in one undifferentiated pile —
 * Hacker News stories and discovered repos. This decides which shelf each one
 * belongs on, so sourcing feeds the whole archive rather than only People Build.
 *
 * Two routers, same output:
 *   Jev      — a Choice across the seven sections plus a "none" escape, when
 *              TYPESAFE_API_KEY is set. It can tell a use case from a news item.
 *   keyword  — a deterministic fallback, so the pipeline never depends on a key.
 *
 * Writes the `routed` map back into data/live.json. Nothing is invented: every
 * routed item keeps the title, link, author and metric it was fetched with.
 *
 *   node scripts/route-signals.mjs
 *   TYPESAFE_API_KEY=... node scripts/route-signals.mjs
 */

import './env.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.TYPESAFE_API_KEY;

/* Nothing reaches a shelf on topic alone — it has to have been noticed.
   These mirror the fetch-time floors and catch anything fetched earlier under
   looser settings, so lowering the bar needs an explicit re-fetch. */
const FLOOR = {
  // Must match the fetcher's floor — two defaults drifting apart silently cut
  // candidates the fetcher deliberately collected. Substance is Jev's call.
  stars:   Number(process.env.MIN_STARS          ?? 1000),
  points:  Number(process.env.MIN_HN_POINTS      ?? 300),
  upvotes: Number(process.env.MIN_REDDIT_UPVOTES ?? 200)
};

/* No shelf should be swamped by one fetch. Keep the most popular, drop the tail. */
const MAX_PER_SECTION = Number(process.env.MAX_PER_SECTION ?? 10);

const SECTIONS = {
  'use-cases': 'A workflow somebody runs to get work done — onboarding onto a repo, test-first loops, refactors, debugging, CI automation. The subject is a way of working.',
  skills:      'A packaged, reusable capability: a SKILL.md, a plugin, a subagent definition, a marketplace of them. The subject is something you install.',
  prompts:     'Specific prompt wording somebody uses and others could copy. The subject is the text you type.',
  settings:    'Configuration: settings.json keys, permissions, hooks, environment variables, model pinning, MCP server config. The subject is a file you edit.',
  commands:    'A command you invoke: a slash command, a CLI flag or invocation, a custom command definition. The subject is something you run.',
  tricks:      'A non-obvious move most people miss — a keystroke, a prefix character, an escape hatch, an undocumented-feeling behaviour.',
  builds:      'A project somebody built and published: a repo, a tool, an app, a wrapper. The subject is software you could go use.'
};

/* ------------------------------------------------------------ keyword router */

const RULES = [
  [/\bskill|SKILL\.md|plugin|subagent|marketplace\b/i, 'skills'],
  [/\bsettings\.json|\bhooks?\b|permission|config|environment variable|statusline/i, 'settings'],
  [/\bslash command\b|\bCLI\b|\s--[a-z-]{3,}|\bclaude -[a-z]\b|(^|\s)\/[a-z-]{3,}\b/i, 'commands'],
  [/\bprompt|prompting|system prompt|CLAUDE\.md\b/i, 'prompts'],
  [/\btrick|shortcut|keyboard|hidden|undocumented|hack\b/i, 'tricks'],
  [/\bworkflow|pipeline|how i use|using claude code to|automat/i, 'use-cases']
];

/* A fetched item has to be about the subject at all before it's shelved. */
const RELEVANT = /\bhermes|agent|skill|prompt|mcp|subagent|harness\b/i;

function routeByKeyword(item) {
  const all = `${item.title} ${item.summary} ${(item.topics || []).join(' ')}`;
  if (!RELEVANT.test(all)) return null;

  // A repo's slug is not evidence: "career-ops-hq/career-ops" is not a slash command.
  // Judge a repo on what it says it is, and keep it on Builds unless that is clear.
  if (item.kind === 'repo') {
    const said = `${item.summary} ${(item.topics || []).join(' ')}`;
    for (const [re, section] of RULES) {
      if (section === 'use-cases') continue;           // too broad to move a project off Builds
      if (re.test(said)) return section;
    }
    return 'builds';
  }

  for (const [re, section] of RULES) if (re.test(all)) return section;
  return 'use-cases';
}

/* ---------------------------------------------------------------- Jev router */

async function routeWithJev(items) {
  const criteria = { ...SECTIONS, none: 'Not about this subject at all, or too thin to be worth a card — general news, drama, an unrelated project.' };
  const out = new Map();
  let judged = 0;

  for (const item of items) {
    const body = {
      model: 'jev-latest',
      state: { item: { title: item.title, summary: item.summary, source: item.source, kind: item.kind } },
      questions: {
        section: {
          type: 'choice',
          instructions: 'An archive of Hermes Agent craft has seven shelves. Which shelf does `item` belong on? Judge what the item is fundamentally about, not what it mentions in passing.',
          criteria
        },
        worth_keeping: {
          type: 'noul',
          instructions: 'Would a reader browsing an archive of Hermes Agent craft learn something useful and specific from `item`?',
          criteria: { true: 'Specific and useful — a concrete technique, tool or finding', false: 'Vague, promotional, or just news about the ecosystem' }
        }
      }
    };

    try {
      const res = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      });
      if (res.status === 401 || res.status === 403) {
        const err = new Error(`${res.status} — the API rejected this key`);
        err.fatal = true;
        throw err;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const { answers } = await res.json();
      const section = answers.section.choice;
      const keep = answers.worth_keeping.noul;

      judged++;
      if (section === 'none' || keep < 0.5) {
        const why = section === 'none'
          ? `not about this subject (${(answers.section.probabilities?.none * 100 || 0).toFixed(0)}% sure)`
          : `too thin to be worth a card (useful to a reader: ${(keep * 100).toFixed(0)}%)`;
        process.stdout.write(`  – dropped  ${item.title.slice(0, 40).padEnd(42)} ${why}\n`);
        continue;
      }
      out.set(item.id, { section, confidence: answers.section.confidence, keep });
      process.stdout.write(`  ✓ ${section.padEnd(10)} ${item.title.slice(0, 54)}\n`);
    } catch (err) {
      // One bad key means every remaining call fails the same way. Stop, don't grind.
      if (err.fatal) {
        console.error(`\nAborted: ${err.message}.`);
        console.error('Set TYPESAFE_API_KEY to a real key, or unset it to use the keyword router.');
        process.exit(1);
      }
      process.stdout.write(`  ✗ ${item.title.slice(0, 40)} — ${err.message}\n`);
    }
  }
  out.judged = judged;
  return out;
}

/* --------------------------------------------------------------------- main */

const live = JSON.parse(await readFile(join(ROOT, 'data/live.json'), 'utf8'));

// Everything already curated by hand wins; a fetched duplicate is dropped.
const curatedUrls = new Set();
const index = JSON.parse(await readFile(join(ROOT, 'data/index.json'), 'utf8'));
for (const s of index.sections) {
  if (!s.file) continue;                 // a computed section has nothing on disk
  const { items } = JSON.parse(await readFile(join(ROOT, 'data', s.file), 'utf8'));
  for (const it of items) if (it.url) curatedUrls.add(it.url);
}

const candidates = [
  ...(live.hn || []).map(h => ({
    id: `hn-${h.id}`, kind: 'post', source: 'hn', title: h.title, summary: h.summary,
    url: h.url, author: h.author, date: h.date,
    metric: { kind: 'points', value: h.points }, metric2: { kind: 'comments', value: h.comments }
  })),
  ...(live.reddit || []).map(r => ({
    id: `rd-${r.id}`, kind: 'post', source: 'reddit', title: r.title, summary: r.summary,
    url: r.url, author: r.author, date: r.date,
    metric: { kind: 'upvotes', value: r.upvotes }, metric2: { kind: 'comments', value: r.comments }
  })),
  ...(live.github || []).filter(g => g.discovered).map(g => ({
    id: `gh-${g.repo.replace(/[^\w]+/g, '-').toLowerCase()}`, kind: 'repo', source: 'github',
    title: g.repo, summary: g.description || 'No project description supplied.',
    url: g.url, date: g.pushedAt, lang: g.language, topics: g.topics,
    metric: { kind: 'stars', value: g.stars }, metric2: { kind: 'forks', value: g.forks }
  }))
].filter(c => !curatedUrls.has(c.url));

const beforeFloor = candidates.length;
const popular = candidates.filter(c => {
  const floor = FLOOR[c.metric?.kind];
  return floor === undefined ? false : c.metric.value >= floor;
});
const dropped = beforeFloor - popular.length;

console.log(`\nPopularity floor: ${FLOOR.stars.toLocaleString()}★ · ${FLOOR.points} HN points · ${FLOOR.upvotes} upvotes`);
if (dropped) console.log(`${dropped} of ${beforeFloor} fetched signals fell below it and were dropped.`);
console.log(`\nRouting ${popular.length} signals with ${KEY ? 'Jev' : 'keyword rules (no TYPESAFE_API_KEY)'}\n`);

const routed = {};
const add = (section, item) => { (routed[section] ||= []).push(item); };

let decided = 0;
if (KEY) {
  const decisions = await routeWithJev(popular);
  decided = decisions.judged;
  for (const c of popular) {
    const d = decisions.get(c.id);
    if (d) add(d.section, { ...c, routedBy: 'jev', routeConfidence: +d.confidence.toFixed(2) });
  }
} else {
  for (const c of popular) {
    const section = routeByKeyword(c);
    if (!section) { process.stdout.write(`  – dropped  ${c.title.slice(0, 54)}\n`); continue; }
    add(section, { ...c, routedBy: 'keyword' });
    process.stdout.write(`  ✓ ${section.padEnd(10)} ${c.title.slice(0, 54)}\n`);
  }
}

// Keep the most popular per shelf; a fetch should not bury what was written by hand.
let capped = 0;
for (const [section, items] of Object.entries(routed)) {
  items.sort((a, b) => (b.metric?.value ?? 0) - (a.metric?.value ?? 0));
  if (items.length > MAX_PER_SECTION) {
    capped += items.length - MAX_PER_SECTION;
    routed[section] = items.slice(0, MAX_PER_SECTION);
  }
}
if (capped) console.log(`\nCapped ${capped} item(s) at ${MAX_PER_SECTION} per section.`);

const total = Object.values(routed).reduce((n, a) => n + a.length, 0);

/* Never trade a good shelf layout for an empty one because a run failed — but a
   run where the judge legitimately rejected every candidate is a result, not an
   error. Only a run that produced no decisions at all is a failure. */
if (total === 0 && popular.length > 0) {
  const judged = KEY ? decided : popular.length;
  console.log(`\nNothing reached a shelf. data/live.json is untouched.`);
  if (judged > 0) {
    console.log(`All ${judged} candidate(s) were judged and rejected — that is a verdict, not a failure.`);
    process.exit(0);
  }
  console.error(`No candidate could be judged at all. Check the errors above.`);
  process.exit(1);
}

live.routed = routed;
live.routedAt = new Date().toISOString();
live.routedBy = KEY ? 'jev' : 'keyword';
await writeFile(join(ROOT, 'data/live.json'), JSON.stringify(live, null, 2) + '\n');

console.log(`\nRouted ${total} of ${beforeFloor} fetched into ${Object.keys(routed).length} sections:`);
for (const [s, a] of Object.entries(routed).sort((x, y) => y[1].length - x[1].length)) console.log(`  ${String(a.length).padStart(3)}  ${s}`);
if (!KEY) console.log('\nKeyword rules can\'t tell a use case from ecosystem news. Set TYPESAFE_API_KEY for the Jev router.');
