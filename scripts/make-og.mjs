#!/usr/bin/env node
/**
 * Render the social cards from the archive's real figures.
 *
 *   assets/social-preview.png      the whole archive — what a pasted home link shows
 *   assets/social/<shelf>.png      one per shelf — what a pasted entry or shelf link shows
 *
 * Every card leads with a count and draws that count: one dot per entry, coloured by the
 * entry's source family. The number and the picture are the same fact, measured at
 * generation time, so the cards have to be regenerated rather than hand-maintained — a
 * card showing a number the site no longer has is the same failure as inventing one.
 * The harvest re-renders them after every arrival.
 *
 * Needs a Chromium on PATH (for the approved Inter/JetBrains Mono, which are not installed
 * locally and would otherwise be substituted). Without one, nothing is written and the
 * existing cards stay.
 *
 *   node scripts/make-og.mjs                # render every card
 *   node scripts/make-og.mjs --only shelf   # render one shelf (or `archive`)
 *   node scripts/make-og.mjs --html-only    # print the rendered HTML paths, no Chromium
 */

import { mergeLive } from '../assets/js/archive.js';
import { creditFor } from '../assets/js/credits.js';
import { visible } from './build-pages.mjs';
import { readFile, writeFile, mkdtemp, mkdir, rename, copyFile, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOCIAL_DIR = join(ROOT, 'assets', 'social');

/* Source families and their colours, the same grouping the hero uses, so a dot means the
   same thing on every picture the archive publishes. */
const FAMILY = {
  docs: 'Docs & repositories', github: 'Docs & repositories',
  x: 'Social', reddit: 'Social', discord: 'Social', linkedin: 'Social', fb: 'Social',
  hn: 'Forums', producthunt: 'Forums',
  blog: 'Long form', podcast: 'Long form', youtube: 'Long form'
};
const HUE = {
  'Docs & repositories': 'var(--accent)', Social: 'var(--violet)',
  'Long form': 'var(--teal)', Forums: 'var(--ink)', Other: 'var(--ink-mute)'
};

/* The line under the number, per shelf. The label alone reads badly for some shelves
   ("19 Hermes works with."), so each one is written out; a new shelf falls back to its
   label until someone writes its line. */
const LINE = {
  'use-cases': 'things people actually build with Hermes Agent.',
  skills: 'Hermes Agent skills worth installing.',
  prompts: 'Hermes Agent prompts you can copy.',
  settings: 'Hermes Agent settings that change the run.',
  commands: 'Hermes Agent commands on the hot path.',
  tricks: 'hidden Hermes Agent tricks, found in the source.',
  releases: 'Hermes Agent releases, what each one changed.',
  toolkit: 'tools that work with Hermes Agent.',
  builds: 'projects people are building on Hermes Agent.',
  'my-work': 'things I have built and posted about Hermes Agent.'
};

/** Chromium goes by several names; the first one on PATH renders. */
const BROWSERS = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];

const read = async f => JSON.parse(await readFile(join(ROOT, 'data', f), 'utf8'));

/** Phyllotaxis field: one dot per entry, densest family first so it reads as a composition. */
export function field(items, cx, cy, radius) {
  const counts = {};
  for (const i of items) { const f = FAMILY[i.source] || 'Other'; counts[f] = (counts[f] || 0) + 1; }
  const order = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const sorted = order.flatMap(f => Array(counts[f]).fill(f));
  const n = sorted.length || 1;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  /* A small shelf stays a cluster rather than seven dots flung across the card: the field
     only reaches the full radius once there are enough entries to fill it. */
  const reach = Math.min(radius, 34 * Math.sqrt(n) + 40);
  const scale = reach / Math.sqrt(n);
  /* Few dots must still read as a field, not as confetti: the dot grows as the count shrinks. */
  const base = Math.min(9, Math.max(2.2, 36 / Math.sqrt(n)));
  const dots = sorted.map((f, i) => {
    const r = scale * Math.sqrt(i + 0.5), a = i * GOLDEN;
    const size = base + (1 - i / n) * base * 0.6;
    return `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="${size.toFixed(2)}" fill="${HUE[f]}" opacity="${(0.5 + 0.5 * (1 - i / n)).toFixed(2)}"/>`;
  }).join('');
  const legend = order.map(f => `<li><i style="background:${HUE[f]}"></i>${f} <b>${counts[f].toLocaleString()}</b></li>`).join('');
  return { dots, legend, count: sorted.length };
}

export function card({ template, tokens, items, people, shelves, latest, headline, line, kicker, caption }) {
  const { dots, legend } = field(items, 905, 316, 204);
  const facts = [
    shelves ? `<b>${shelves}</b> SHELVES` : null,
    `<b>${people.toLocaleString()}</b> ${people === 1 ? 'PERSON' : 'PEOPLE'} CREDITED`,
    latest ? `UPDATED <b>${latest}</b>` : null
  ].filter(Boolean).join('<span class="dot">·</span>');
  return template
    .replace('<!--TOKENS-->', tokens)
    .replace('<!--KICKER-->', kicker)
    .replace('<!--COUNT-->', headline.toLocaleString())
    .replace('<!--LINE-->', line)
    .replace('<!--FACTS-->', facts)
    .replace('<!--DOTS-->', dots)
    .replace('<!--LEGEND-->', legend)
    .replace('<!--CAPTION-->', caption);
}

/** Render one HTML page to a 1200×630 PNG with the first Chromium found, or throw. */
async function render(page, out) {
  let lastError;
  for (const bin of BROWSERS) {
    try {
      await run(bin, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
                      '--window-size=1200,630', `--screenshot=${out}`, `file://${page}`]);
      const png = await readFile(out);
      if (png.length < 1000 || png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) throw new Error('Invalid rendered PNG');
      return;
    } catch (error) {
      lastError = error;
      if (error.code !== 'ENOENT') throw error;      // a real render failure, not a missing binary
    }
  }
  throw new Error(`no Chromium on PATH (tried ${BROWSERS.join(', ')}): ${lastError?.message}`);
}

/** Move a file that may be on another filesystem: rename when possible, copy when not. */
async function moveInto(from, to) {
  try { await rename(from, to); }
  catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await copyFile(from, to);
    await unlink(from).catch(() => {});
  }
}

/** "11 Oct 2026", from the newest arrival date — a measured date, never today's. */
export function updatedLabel(added) {
  const latest = Object.values(added?.added || {}).sort().at(-1);
  if (!latest) return null;
  const d = new Date(latest + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

async function main() {
  const cfg = await read('index.json');
  const live = await read('live.json');
  const added = await read('added.json').catch(() => null);
  const byRepo = new Map((live.github || []).map(g => [g.repo.toLowerCase(), g]));

  const data = {};
  for (const section of cfg.sections) {
    if (!section.file) continue;
    data[section.id] = (await read(section.file)).items;
  }
  mergeLive(data, live);
  /* Only what the site shows: an entry withheld by the star floor is not on any shelf,
     so it is not in any count or any dot. */
  for (const id of Object.keys(data)) {
    const kept = [];
    for (const item of data[id]) if (await visible(item, byRepo)) kept.push(item);
    data[id] = kept;
  }

  const credited = items => new Set(items.map(creditFor).filter(c => c.label !== 'Author').map(c => c.name)).size;
  const all = Object.values(data).flat();
  const shelves = Object.values(data).filter(items => items.length).length;
  const latest = updatedLabel(added);
  const template = await readFile(join(ROOT, 'assets/og-template.html'), 'utf8');
  const tokens = (await readFile(join(ROOT, 'assets/css/style.css'), 'utf8')).match(/:root\s*\{[\s\S]*?\}/)[0];

  const jobs = [{
    id: 'archive',
    out: join(ROOT, 'assets/social-preview.png'),
    count: all.length,
    html: card({
      template, tokens, items: all, people: credited(all), shelves, latest,
      headline: all.length, line: 'Hermes Agent ideas, quoted, credited and linked to the source.',
      kicker: 'HERMES AGENT ARCHIVE', caption: 'one dot per entry · colour is where it came from'
    })
  }];
  for (const section of cfg.sections) {
    if (!section.file || !data[section.id]?.length) continue;
    const items = data[section.id];
    jobs.push({
      id: section.id,
      out: join(SOCIAL_DIR, `${section.id}.png`),
      count: items.length,
      html: card({
        template, tokens, items, people: credited(items), shelves: 0, latest,
        headline: items.length, line: LINE[section.id] || `${section.label.toLowerCase()} for Hermes Agent.`,
        kicker: `HERMES AGENT ARCHIVE · ${section.label.toUpperCase()}`,
        caption: 'one dot per entry on this shelf · colour is where it came from'
      })
    });
  }

  const onlyArg = process.argv.indexOf('--only');
  const wanted = onlyArg > -1 ? jobs.filter(j => j.id === process.argv[onlyArg + 1]) : jobs;
  if (!wanted.length) throw new Error(`--only names no card; cards are: ${jobs.map(j => j.id).join(', ')}`);

  const dir = await mkdtemp(join(tmpdir(), 'og-'));
  await mkdir(SOCIAL_DIR, { recursive: true });
  const htmlOnly = process.argv.includes('--html-only');
  for (const job of wanted) {
    const page = join(dir, `${job.id}.html`);
    await writeFile(page, job.html);
    if (htmlOnly) { console.log(page); continue; }
    const rendered = join(dir, `${job.id}.png`);
    /* The render happens in the system temp directory, which on this machine is a tmpfs
       and therefore a different filesystem from the repository. rename() cannot cross one,
       so it fails with EXDEV and the image silently never updates. Copy, then remove. */
    await render(page, rendered);
    await moveInto(rendered, job.out);
    console.log(`wrote ${job.out.replace(ROOT + '/', '')} — ${job.count.toLocaleString()} entries`);
  }
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('Could not render the social cards; the existing images are unchanged.');
    console.error(error.message);
    process.exit(1);
  });
}
