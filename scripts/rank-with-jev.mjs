#!/usr/bin/env node
/**
 * Rank candidate capabilities for this site with TypeSafe's Jev.
 *
 * Each candidate is scored on three independent dimensions in one request
 * (they're independent judgments over the same state, so they run in parallel),
 * plus one yes/no on whether the candidate belongs in the archive as content
 * rather than being built as a feature. Code — not the model — owns the policy
 * that turns those scores into a priority order, so you can re-weight without
 * re-running inference.
 *
 *   TYPESAFE_API_KEY=... node scripts/rank-with-jev.mjs
 *   TYPESAFE_API_KEY=... node scripts/rank-with-jev.mjs --weights 0.5,0.3,0.2
 */

import './env.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const KEY = process.env.TYPESAFE_API_KEY;

if (!KEY) {
  console.error(`TYPESAFE_API_KEY is not set.

  export TYPESAFE_API_KEY=...        # then re-run
  node scripts/rank-with-jev.mjs

Get a key at https://typesafe.ai — the key stays in your shell; it is never
written to this repo.`);
  process.exit(1);
}

/* The site Jev is judging candidates against. Keep this current: it is the
   entire basis for every "does this site need it?" answer. */
const SITE = {
  what: 'A private, static archive site that catalogues the Claude Code craft people actually use: use cases, skills, prompts, settings, commands, hidden tricks, and community builds.',
  audience: 'The owner\'s followers on X, plus the owner, who mines the archive for post material.',
  stack: 'Plain HTML, CSS and vanilla ES modules. No framework, no build step, no server, no database. Content is JSON files in the repo, served as static files from GitHub Pages.',
  alreadyHas: [
    'seven sections with 86 hand-written items',
    'filtering by source (X, Reddit, Hacker News, Facebook, GitHub, docs), time range and tag',
    'substring search across title, summary, body and tags',
    'sort by public metric, by recency, or alphabetically',
    'a detail drawer with copy-to-clipboard snippets',
    'a nightly-capable fetch script pulling real GitHub stars/forks and Hacker News points',
    'GitHub search discovery that surfaces community projects nobody seeded'
  ],
  knownWeaknesses: [
    'search is a literal substring match, so a visitor who asks for a concept in their own words finds nothing',
    'no votes, no view counts and no engagement signal of its own',
    'no submission flow — the "submit a trick" button goes nowhere',
    'every item was written or picked by hand, so nothing scales',
    'no X or Facebook metrics, because neither has a free public API'
  ]
};

const WEIGHTS = (() => {
  const i = process.argv.indexOf('--weights');
  if (i === -1) return { fit: 0.45, value: 0.35, effort: 0.20 };
  const [fit, value, effort] = process.argv[i + 1].split(',').map(Number);
  return { fit, value, effort };
})();

async function ask(candidate) {
  const body = {
    model: MODEL,
    state: { site: SITE, candidate },
    questions: {
      fit: {
        type: 'score',
        instructions: 'Given `site`, how directly does the capability described in `candidate` address something this specific site needs? Judge need, not how impressive the candidate project is.',
        criteria: [
          'Unrelated — the site would never use this capability',
          'Tangential — imaginable, but solves a problem this site does not have',
          'Useful later — a real improvement, but not one of this site\'s stated weaknesses',
          'Clearly needed — directly improves something the site does badly today',
          'Core gap — addresses a weakness named in `site.knownWeaknesses` head-on'
        ]
      },
      value: {
        type: 'score',
        instructions: 'How much better would a visit to `site` be for one of `site.audience` if this capability existed? Judge the experience of a person browsing and finding what they came for.',
        criteria: [
          'No visible difference to a visitor',
          'Marginal — a nicety a few people would notice',
          'Noticeable — visitors would find useful things faster',
          'Substantial — changes how people use the site',
          'Transformative — the main reason someone would come back'
        ]
      },
      effort: {
        type: 'score',
        instructions: 'How much work is it to add this capability to `site`, given `site.stack`? A static site with no server or database has to pay for anything needing one.',
        criteria: [
          'An afternoon — client-side only, no new infrastructure',
          'A day or two — a build-time script plus committed data',
          'Substantial — needs an API key, a scheduled job, or a hosted endpoint',
          'Heavy — needs a database, accounts, or a backend the site does not have',
          'Out of scope — a different product, not a feature of this site'
        ]
      },
      is_content: {
        type: 'noul',
        instructions: 'Is `candidate` more valuable to `site` as an archive entry — something to write up and publish for readers — than as a capability to build into the site itself?',
        criteria: {
          true: 'Interesting to read about; the site should catalogue it',
          false: 'The site should actually build and run this'
        }
      }
    }
  };

  const res = await fetch(API, {
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
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const candidates = JSON.parse(await readFile(join(ROOT, 'data/research/jev-use-cases.json'), 'utf8')).items;
console.log(`Scoring ${candidates.length} candidates with ${MODEL}…\n`);

const results = [];
let usage = { input_tokens: 0, output_tokens: 0 };

for (const c of candidates) {
  try {
    const out = await ask(c);
    const a = out.answers;
    const n = v => v / 4;                       // five levels -> 0..1
    const priority =
      WEIGHTS.fit    * n(a.fit.score) +
      WEIGHTS.value  * n(a.value.score) -
      WEIGHTS.effort * n(a.effort.score);

    results.push({
      title: c.title, url: c.url, author: c.author, category: c.category,
      fit: +a.fit.score.toFixed(2),
      value: +a.value.score.toFixed(2),
      effort: +a.effort.score.toFixed(2),
      contentNotFeature: +a.is_content.noul.toFixed(2),
      lowestConfidence: +Math.min(a.fit.confidence, a.value.confidence, a.effort.confidence).toFixed(2),
      priority: +priority.toFixed(3)
    });
    usage.input_tokens += out.usage?.input_tokens || 0;
    usage.output_tokens += out.usage?.output_tokens || 0;
    process.stdout.write(`  ✓ ${c.title}\n`);
  } catch (err) {
    if (err.fatal) {
      console.error(`\nAborted: ${err.message}. Check TYPESAFE_API_KEY and re-run.`);
      process.exit(1);
    }
    process.stdout.write(`  ✗ ${c.title} — ${err.message}\n`);
  }
}

if (!results.length) {
  console.error('\nNothing scored — not writing an empty ranking file.');
  process.exit(1);
}

results.sort((a, b) => b.priority - a.priority);

const build = results.filter(r => r.contentNotFeature < 0.5);
const publish = results.filter(r => r.contentNotFeature >= 0.5);

console.log('\nBUILD THESE (Jev says feature, not content)\n');
console.log('  pri    fit  val  eff  conf   candidate');
for (const r of build) {
  console.log(`  ${r.priority.toFixed(2).padStart(5)}  ${r.fit.toFixed(1)}  ${r.value.toFixed(1)}  ${r.effort.toFixed(1)}  ${r.lowestConfidence.toFixed(2)}   ${r.title}`);
}
console.log('\nPUBLISH INSTEAD (better as an archive entry)\n');
for (const r of publish) console.log(`  ${r.priority.toFixed(2).padStart(5)}   ${r.title}`);

await writeFile(join(ROOT, 'data/research/jev-ranking.json'),
  JSON.stringify({ rankedAt: new Date().toISOString(), model: MODEL, weights: WEIGHTS, usage, results }, null, 2) + '\n');

console.log(`\nWrote data/research/jev-ranking.json · ${usage.input_tokens} in / ${usage.output_tokens} out tokens.`);
console.log('Re-weight without re-running inference: --weights fit,value,effort');
