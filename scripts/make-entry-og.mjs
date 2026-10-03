#!/usr/bin/env node
/** Render individual 1200×630 cards with system Chromium; no npm dependencies.
 * node scripts/make-entry-og.mjs prompt-parallel-research [another-id]
 * node scripts/make-entry-og.mjs --missing [ids...]
 * node scripts/make-entry-og.mjs --dry-run --missing
 * Optional --out-dir PATH keeps review samples outside the deployment assets.
 */
import { readFile, writeFile, mkdtemp, mkdir, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { creditFor } from '../assets/js/credits.js';
import { agentFor, shelfLabel, SOURCE_LABEL, escapeHTML as esc } from '../assets/js/directory.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export const isCardPNG = png => png.length > 1000 && png.subarray(0, 8).equals(signature)
  && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630;

export function parseArgs(args) {
  const options = { ids: [], missing: false, dryRun: false, outDir: join(ROOT, 'assets/og/entries') };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--missing') options.missing = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--out-dir') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--out-dir needs a path');
      options.outDir = resolve(args[++i]);
    } else if (!/^[a-z0-9][a-z0-9-]*$/i.test(arg)) throw new Error(`Invalid id or option: ${arg}`);
    else options.ids.push(arg);
  }
  options.ids = [...new Set(options.ids)];
  if (!options.ids.length && !options.missing) throw new Error('Supply entry ids or --missing. Add --dry-run to inspect the batch without rendering.');
  return options;
}

export async function loadEntries(root = ROOT) {
  const cfg = JSON.parse(await readFile(join(root, 'data/index.json'), 'utf8'));
  const entries = new Map();
  // Render stored entries, without applying volatile popularity/eligibility filters.
  // A card makes no metric or eligibility claim; source credit is the only evidence.
  for (const section of cfg.sections) {
    if (!section.file) continue;
    const data = JSON.parse(await readFile(join(root, 'data', section.file), 'utf8'));
    for (const item of data.items) {
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(item.id)) throw new Error(`Unsafe entry id: ${item.id}`);
      if (entries.has(item.id)) throw new Error(`Duplicate entry id: ${item.id}`);
      entries.set(item.id, { item, section });
    }
  }
  return entries;
}

export function entryHTML(template, tokens, { item, section }) {
  const credit = creditFor(item);
  const values = {
    TOKENS: tokens,
    TITLE: esc(item.title),
    AGENT: esc(agentFor(item)),
    SHELF: esc(shelfLabel(section)),
    CREDIT: esc(`${credit.label} ${credit.name}`),
    SOURCE: esc(SOURCE_LABEL[item.source] || item.source || 'Source not recorded'),
    HOST: esc(item.url ? new URL(item.url).hostname : 'Source not recorded')
  };
  // One pass: placeholder-looking text in source data must remain literal.
  return template.replace(/<!--(TOKENS|TITLE|AGENT|SHELF|CREDIT|SOURCE|HOST)-->/g, (_, key) => values[key]);
}

export async function generate(options, { root = ROOT, render } = {}) {
  const entries = await loadEntries(root);
  const ids = options.ids.length ? options.ids : [...entries.keys()];
  // Validate the whole request before creating or replacing any output.
  for (const id of ids) if (!entries.has(id)) throw new Error(`Unknown entry id: ${id}`);
  const pending = [];
  for (const id of ids) {
    let existing = false;
    try { existing = isCardPNG(await readFile(join(options.outDir, `${id}.png`))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!options.missing || !existing) pending.push(id);
  }
  console.log(`${entries.size} stored entries; ${pending.length} card(s) to render; ${ids.length - pending.length} valid existing card(s) skipped.`);
  if (options.dryRun || !pending.length) return { count: pending.length, bytes: 0 };
  const css = await readFile(join(root, 'assets/css/style.css'), 'utf8');
  const tokens = css.match(/:root\s*\{[\s\S]*?\}/)?.[0];
  if (!tokens) throw new Error('Missing :root design tokens');
  const template = await readFile(join(root, 'assets/entry-og-template.html'), 'utf8');
  await mkdir(options.outDir, { recursive: true });
  // Stage on the destination filesystem so rename is atomic (also across tmpfs).
  const temporary = await mkdtemp(join(options.outDir, '.render-'));
  let bytes = 0;
  let browser;
  try {
    if (!render) { browser = await chromiumRenderer(temporary); render = browser.render; }
    for (const id of pending) {
      const page = join(temporary, 'entry.html');
      const pngPath = join(temporary, `${id}.png`);
      await writeFile(page, entryHTML(template, tokens, entries.get(id)));
      await render(page, pngPath, temporary);
      const png = await readFile(pngPath);
      if (!isCardPNG(png)) throw new Error(`Invalid 1200×630 PNG for ${id}`);
      bytes += png.length;
    }
    // A render failure leaves every previous card in this batch untouched.
    for (const id of pending) await rename(join(temporary, `${id}.png`), join(options.outDir, `${id}.png`));
  } finally {
    if (browser) await browser.close();
    await rm(temporary, { recursive: true, force: true });
  }
  console.log(`Wrote ${pending.length} cards, ${(bytes / 1048576).toFixed(2)} MiB total, to ${options.outDir}`);
  return { count: pending.length, bytes };
}

/** One Chromium process per batch. DevTools' null-delimited pipe is built into
 * Chromium and Node: no browser library, server, debugging port or npm install.
 * Reusing the browser also caches the approved fonts across all 973 renders. */
async function chromiumRenderer(temporary) {
  const child = spawn('chromium', ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', '--remote-debugging-pipe', `--user-data-dir=${join(temporary, 'chromium')}`],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let serial = 0, buffer = '', diagnostic = '', stopped = false;
  const pending = new Map();
  const fail = error => { for (const task of pending.values()) { clearTimeout(task.timer); task.reject(error); } pending.clear(); };
  child.stderr.on('data', data => { diagnostic = (diagnostic + data).slice(-2000); });
  child.on('error', error => { stopped = true; fail(error); });
  child.on('exit', code => { stopped = true; fail(new Error(`Chromium exited (${code}): ${diagnostic}`)); });
  child.stdio[3].on('error', fail);
  child.stdio[4].setEncoding('utf8');
  child.stdio[4].on('data', data => {
    buffer += data.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
      const task = pending.get(message.id);
      if (!task) continue;
      pending.delete(message.id); clearTimeout(task.timer);
      if (message.error) task.reject(new Error(message.error.message));
      else task.resolve(message.result);
    }
  });
  function command(method, params = {}, sessionId) {
    if (stopped) return Promise.reject(new Error('Chromium is no longer running'));
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chromium timed out: ${method}`)); }, 30000);
      pending.set(id, { resolve, reject, timer });
      child.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
  }
  const close = async () => {
    if (stopped) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    await exited; clearTimeout(timer);
  };
  try {
    const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => command(method, params, sessionId);
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
    return {
      close,
      render: async (page, output) => {
        // Wait for this specific document, including both external font faces and
        // its title-fitting script. The marker avoids a previous document race.
        const marker = `${Date.now()}-${serial}`;
        // Navigate to a unique query so successive writes never reuse stale HTML.
        const { errorText } = await send('Page.navigate', { url: new URL(`file://${page}?render=${marker}`).href });
        if (errorText) throw new Error(errorText);
        for (let attempt = 0; ; attempt++) {
          const result = await send('Runtime.evaluate', { expression: `location.search.includes(${JSON.stringify(marker)}) && document.readyState === 'complete'`, returnByValue: true });
          if (result.result?.value === true) break;
          if (attempt > 200) throw new Error('Entry page did not finish loading');
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        const ready = await send('Runtime.evaluate', {
          expression: `document.fonts.ready.then(async () => { await fit(); return { fonts: document.fonts.check('600 54px Inter') && document.fonts.check('500 16px "JetBrains Mono"'), fits: document.querySelector('footer').getBoundingClientRect().bottom <= 630 && document.documentElement.scrollWidth <= 1200 }; })`,
          awaitPromise: true, returnByValue: true
        });
        if (ready.exceptionDetails || !ready.result?.value?.fonts || !ready.result?.value?.fits) throw new Error('Entry card fonts or layout could not be verified');
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(output, Buffer.from(shot.data, 'base64'));
      }
    };
  } catch (error) { await close(); throw error; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await generate(parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(`Entry cards failed: ${error.message}`); process.exitCode = 1; }
}
