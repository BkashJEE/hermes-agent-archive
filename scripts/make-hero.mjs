#!/usr/bin/env node
/**
 * Render assets/hero.png — one mark per entry in the archive.
 *
 * Not decoration: the dot count is the entry count and each dot takes the colour
 * of its own source family, at generation time. Regenerate after data changes. If the
 * archive grows, the spiral grows with it.
 *
 * Phyllotaxis placement (the sunflower arrangement) gives an even, non-gridded
 * field at any count without any hand-tuning.
 *
 *   node scripts/make-hero.mjs
 */

import { readFile, writeFile, mkdtemp, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mergeLive } from '../assets/js/archive.js';
import { creditFor } from '../assets/js/credits.js';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/hero.png');

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

const read = async f => JSON.parse(await readFile(join(ROOT, 'data', f), 'utf8'));
const cfg = await read('index.json');
const live = await read('live.json');
const data = {};
for (const section of cfg.sections) {
  if (!section.file) continue;
  data[section.id] = (await read(section.file)).items;
}
mergeLive(data, live);
const items = Object.values(data).flat();
const entries = items.map(item => FAMILY[item.source] || 'Other');
const authors = new Set(items.map(creditFor).filter(c => c.label !== 'Author').map(c => c.name));
const tokens = (await readFile(join(ROOT, 'assets/css/style.css'), 'utf8')).match(/:root\s*\{[\s\S]*?\}/)[0];

/* Densest families first, so the eye reads the spiral as a composition rather
   than as scatter — the order is derived, never chosen. */
const counts = entries.reduce((m, f) => (m[f] = (m[f] || 0) + 1, m), {});
const order = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
const sorted = order.flatMap(f => Array(counts[f]).fill(f));

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const CX = 890, CY = 315, SCALE = 285 / Math.sqrt(entries.length || 1);
const dots = sorted.map((family, i) => {
  const r = SCALE * Math.sqrt(i + 0.5);
  const a = i * GOLDEN;
  const x = CX + r * Math.cos(a), y = CY + r * Math.sin(a);
  const size = 2.1 + (1 - i / sorted.length) * 1.5;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(2)}" fill="${HUE[family]}" opacity="${(0.55 + 0.45 * (1 - i / sorted.length)).toFixed(2)}"/>`;
}).join('');

const legend = order.map(f =>
  `<li><i style="background:${HUE[f]}"></i>${f}<b>${counts[f].toLocaleString()}</b></li>`).join('');

const html = `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
 ${tokens}
 *{margin:0;padding:0;box-sizing:border-box}
 body{width:1200px;height:630px;overflow:hidden;position:relative;background:
   radial-gradient(680px 460px at 74% 50%,var(--wash-amber),transparent 68%),
   radial-gradient(520px 340px at 4% 100%,var(--wash-violet),transparent 62%),var(--bg);
   color:var(--ink);font-family:var(--sans)}
 .edge{position:absolute;left:0;top:0;width:6px;height:100%;background:linear-gradient(var(--accent),var(--accent) 55%,var(--teal))}
 svg.field{position:absolute;inset:0}
 .left{position:absolute;left:66px;top:62px;width:520px}
 .kick{font-family:var(--mono);font-size:13px;letter-spacing:.26em;color:var(--accent);font-weight:700}
 h1{margin-top:40px;font-size:62px;line-height:1;font-weight:600;letter-spacing:-.03em}
 h1 em{font-style:normal;color:var(--accent)}
 .sub{font-family:var(--sans);font-size:20px;line-height:1.5;color:var(--ink-dim);margin-top:22px;max-width:26ch}
 ul{position:absolute;left:66px;bottom:104px;list-style:none;display:flex;gap:20px;flex-wrap:wrap}
 li{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--ink-dim)}
 li i{width:8px;height:8px;border-radius:50%}
 li b{font-family:var(--mono);color:var(--ink);font-weight:700}
 .foot{position:absolute;left:66px;bottom:58px;font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;color:var(--ink-mute)}
 .foot b{color:var(--teal);font-weight:400}
</style>
<div class="edge"></div>
<svg class="field" viewBox="0 0 1200 630">${dots}</svg>
<div class="left">
  <div class="kick">HERMES AGENT ARCHIVE</div>
  <h1>Find your next<br><em>Hermes</em><br>workflow.</h1>
  <p class="sub">Workflows, prompts, skills and projects.<br>One dot per entry in this snapshot.</p>
</div>
<ul>${legend}</ul>
<div class="foot">${entries.length.toLocaleString()} ENTRIES · ${authors.size} CREDITED NAMES · <b>counted from the loaded archive</b></div>`;

const dir = await mkdtemp(join(tmpdir(), 'hero-'));
const page = join(dir, 'hero.html');
await writeFile(page, html);
if (process.argv.includes('--html-only')) { console.log(page); process.exit(0); }
const rendered = join(dir, 'hero.png');

try {
  await run('chromium', ['--headless=new', '--disable-gpu', '--hide-scrollbars',
                         '--window-size=1200,630', `--screenshot=${rendered}`, `file://${page}`]);
  const png = await readFile(rendered);
  if (png.length < 1000 || png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) throw new Error('Invalid rendered PNG');
  await rename(rendered, OUT);
} catch (err) {
  console.error('Could not render; existing hero is unchanged:', err.message);
  process.exit(1);
}
console.log(`\nWrote assets/hero.png — ${entries.length} dots, ${order.length} families, ${authors.size} credited\n`);
