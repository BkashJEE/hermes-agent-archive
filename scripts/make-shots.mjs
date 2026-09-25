#!/usr/bin/env node
/**
 * Screenshot every shelf for the README, from the real site.
 *
 *   npm run shots            # all shelves
 *   npm run shots skills     # one
 *
 * The README should show what the archive actually looks like today, not a picture that
 * was true three hundred entries ago. These are captured from the local server against
 * the current data, so regenerating them is the way to keep them honest.
 *
 * Needs chromium on PATH, for the same reason make-og.mjs does: the approved Inter and
 * JetBrains Mono come from the page, and a headless browser is what renders them.
 * If chromium cannot run, the existing images are left alone rather than replaced with
 * something wrong.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, rename, copyFile, unlink, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'images');
const PORT = 4321;
const SIZE = { width: 1600, height: 1000 };

/* One image per shelf, named after the section id so the README can find it. */
const SHOTS = [
  { id: 'dashboard',  hash: '#dashboard' },
  { id: 'use-cases',  hash: '#use-cases' },
  { id: 'skills',     hash: '#skills' },
  { id: 'prompts',    hash: '#prompts' },
  { id: 'commands',   hash: '#commands' },
  { id: 'settings',   hash: '#settings' },
  { id: 'trending',   hash: '#trending' },
  { id: 'my-work',    hash: '#my-work' }
];

const run = (cmd, args) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { stdio: 'ignore' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
});

/** Move a file that may be on another filesystem: rename when possible, copy when not. */
async function moveInto(from, to) {
  try { await rename(from, to); }
  catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await copyFile(from, to);
    await unlink(from).catch(() => {});
  }
}

const wanted = process.argv.slice(2).filter(a => !a.startsWith('--'));
const shots = wanted.length ? SHOTS.filter(s => wanted.includes(s.id)) : SHOTS;
if (!shots.length) throw new Error(`No shelf matched. Known: ${SHOTS.map(s => s.id).join(', ')}`);

await mkdir(OUT, { recursive: true });

/* Serve the real site rather than a file:// page: the archive loads its data with
   fetch(), which file:// refuses. */
const server = spawn(process.execPath, [join(ROOT, 'scripts', 'serve.mjs')],
  { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });

const ready = async () => {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
};

let failed = 0;
try {
  if (!await ready()) throw new Error(`the local server never answered on ${PORT}`);

  for (const shot of shots) {
    const dir = await mkdtemp(join(tmpdir(), 'shot-'));
    try {
      await run('chromium', [
        '--headless=new', '--disable-gpu', '--hide-scrollbars',
        `--window-size=${SIZE.width},${SIZE.height}`,
        '--screenshot=' + join(dir, 'out.png'),
        /* The shelf renders from the hash, and the cache buster defeats the aggressive
           local cache so a data change actually shows up. */
        `--virtual-time-budget=4000`,
        `http://127.0.0.1:${PORT}/?shot=${Date.now()}${shot.hash}`
      ]);
      await moveInto(join(dir, 'out.png'), join(OUT, `${shot.id}.png`));
      console.log(`  docs/images/${shot.id}.png`);
    } catch (error) {
      failed++;
      console.error(`  ${shot.id}: ${error.message} — existing image left alone`);
    }
  }
} finally {
  server.kill();
}

const counts = JSON.parse(await readFile(join(ROOT, 'data', 'index.json'), 'utf8'));
console.log(`\n${shots.length - failed} of ${shots.length} shelves captured at ${SIZE.width}x${SIZE.height}, from ${counts.sections.length} configured sections.`);
if (failed) process.exitCode = 1;
