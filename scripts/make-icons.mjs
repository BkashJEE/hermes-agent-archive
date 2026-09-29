#!/usr/bin/env node
/**
 * Render the site's raster icons from assets/mark.svg.
 *
 *   npm run icons
 *
 * The page declared `<link rel="icon">` with no href and let app.js fill it in at runtime
 * from the current theme colour. That is a nice touch in a browser and nothing at all
 * everywhere else: a crawler, a link unfurler, a reader with JavaScript off and the
 * default /favicon.ico request all got no icon. The static file is the floor; the
 * runtime tint still plays over it.
 *
 * Needs chromium on PATH, the same dependency make-og.mjs already has. If it cannot run,
 * existing icons are left alone rather than replaced with something wrong.
 */

import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rename, copyFile, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARK = join(ROOT, 'assets', 'mark.svg');

/* apple-touch-icon is the one iOS uses when someone saves the site to a home screen, and
   the 32px PNG is the fallback for anything that will not take an SVG. */
const ICONS = [
  { file: 'apple-touch-icon.png', size: 180, pad: 26, background: '#12121a' },
  { file: 'icon-32.png',          size: 32,  pad: 3,  background: 'transparent' }
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

async function main() {
  const svg = await readFile(MARK, 'utf8');
  if (!/stroke="#/.test(svg))
    throw new Error('assets/mark.svg must carry an explicit stroke colour; currentColor renders as nothing outside the page.');

  let failed = 0;
  for (const icon of ICONS) {
    const dir = await mkdtemp(join(tmpdir(), 'icon-'));
    const page = join(dir, 'icon.html');
    const inner = svg.replace(/width="\d+"/, `width="${icon.size - icon.pad * 2}"`)
                     .replace(/height="\d+"/, `height="${icon.size - icon.pad * 2}"`);
    await writeFile(page, `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:${icon.size}px;height:${icon.size}px;
background:${icon.background};display:grid;place-items:center}</style>${inner}`);
    try {
      await run('chromium', ['--headless=new', '--disable-gpu', '--hide-scrollbars',
        `--window-size=${icon.size},${icon.size}`,
        ...(icon.background === 'transparent' ? ['--default-background-color=00000000'] : []),
        '--screenshot=' + join(dir, 'out.png'), pathToFileURL(page).href]);
      await moveInto(join(dir, 'out.png'), join(ROOT, 'assets', icon.file));
      console.log(`  assets/${icon.file}  ${icon.size}x${icon.size}`);
    } catch (error) {
      failed++;
      console.error(`  ${icon.file}: ${error.message} — existing file left alone`);
    }
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
