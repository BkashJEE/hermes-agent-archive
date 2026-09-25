#!/usr/bin/env node
/**
 * Render assets/hero.png — one mark per entry in the archive.
 *
 * Not decoration: the dot count is the entry count and each dot takes the colour
 * of its own source family, so the picture cannot drift from the data. If the
 * archive grows, the spiral grows with it.
 *
 * Phyllotaxis placement (the sunflower arrangement) gives an even, non-gridded
 * field at any count without any hand-tuning.
 *
 *   node scripts/make-hero.mjs
 */

import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/hero.png');

const FAMILY = {
  docs: 'Official docs', github: 'Official docs',
  x: 'Social', reddit: 'Social', discord: 'Social', linkedin: 'Social', fb: 'Social',
  hn: 'Forums', producthunt: 'Forums',
  blog: 'Long form', podcast: 'Long form', youtube: 'Long form'
};
const HUE = {
  'Official docs': '#f5a524', Social: '#8b7cf6',
  'Long form': '#2dd4bf', Forums: '#dcdce6', Other: '#6d6d7a'
};

const read = async f => JSON.parse(await readFile(join(ROOT, 'data', f), 'utf8'));
const cfg = await read('index.json');
const live = await read('live.json').catch(() => ({}));
const routed = live.routed || {};

const entries = [];
const authors = new Set();
for (const s of cfg.sections) {
  if (!s.file) continue;
  for (const it of [...(await read(s.file)).items, ...(routed[s.id] || [])]) {
    entries.push(FAMILY[it.source] || 'Other');
    if (it.author) authors.add(it.author);
  }
}

/* Densest families first, so the eye reads the spiral as a composition rather
   than as scatter — the order is derived, never chosen. */
const counts = entries.reduce((m, f) => (m[f] = (m[f] || 0) + 1, m), {});
const order = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
const sorted = order.flatMap(f => Array(counts[f]).fill(f));

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const CX = 890, CY = 315, SCALE = 11.4;
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
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Lora:ital@1&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
 *{margin:0;padding:0;box-sizing:border-box}
 body{width:1200px;height:630px;overflow:hidden;position:relative;background:
   radial-gradient(680px 460px at 74% 50%,rgba(245,165,36,.10),transparent 68%),
   radial-gradient(520px 340px at 4% 100%,rgba(139,124,246,.10),transparent 62%),#0a0a0f;
   color:#ededf2;font-family:'Poppins',sans-serif}
 .edge{position:absolute;left:0;top:0;width:6px;height:100%;background:linear-gradient(#f5a524,#e08a10 55%,#2dd4bf)}
 svg.field{position:absolute;inset:0}
 .left{position:absolute;left:66px;top:62px;width:520px}
 .kick{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.26em;color:#f5a524;font-weight:700}
 h1{margin-top:40px;font-size:62px;line-height:1;font-weight:600;letter-spacing:-.03em}
 h1 em{font-style:normal;color:#f5a524}
 .sub{font-family:'Lora',serif;font-style:italic;font-size:20px;line-height:1.5;color:#a8a8b5;margin-top:22px;max-width:26ch}
 ul{position:absolute;left:66px;bottom:104px;list-style:none;display:flex;gap:20px;flex-wrap:wrap}
 li{display:flex;align-items:center;gap:7px;font-size:11.5px;color:#a8a8b5}
 li i{width:8px;height:8px;border-radius:50%}
 li b{font-family:'JetBrains Mono',monospace;color:#ededf2;font-weight:700}
 .foot{position:absolute;left:66px;bottom:58px;font-family:'JetBrains Mono',monospace;font-size:11.5px;letter-spacing:.1em;color:#6d6d7a}
 .foot b{color:#2dd4bf;font-weight:400}
</style>
<div class="edge"></div>
<svg class="field" viewBox="0 0 1200 630">${dots}</svg>
<div class="left">
  <div class="kick">HERMES AGENT ARCHIVE</div>
  <h1>${entries.length.toLocaleString()} things<br>people <em>actually</em><br>built.</h1>
  <p class="sub">One dot for every entry, coloured by where it came from.</p>
</div>
<ul>${legend}</ul>
<div class="foot">${authors.size} PEOPLE CREDITED · <b>every number fetched, never guessed</b></div>`;

const dir = await mkdtemp(join(tmpdir(), 'hero-'));
const page = join(dir, 'hero.html');
await writeFile(page, html);

try {
  await run('chromium', ['--headless=new', '--disable-gpu', '--hide-scrollbars',
                         '--window-size=1200,630', `--screenshot=${OUT}`, `file://${page}`]);
} catch (err) {
  console.error('chromium could not render:', err.message);
  process.exit(1);
}
console.log(`\nWrote assets/hero.png — ${entries.length} dots, ${order.length} families, ${authors.size} credited\n`);
