#!/usr/bin/env node
/**
 * Re-read every upstream source that grows, and report what arrived.
 *
 *   npm run harvest          # run every safe importer, then summarise
 *   npm run harvest -- --dry # say what would run, change nothing
 *
 * The daily refresh fetches metrics. This is the other half: the sources themselves gain
 * entries over time — Nous publishes more user stories, the Jev directory lists more
 * builders, discovery finds repositories and threads that did not exist last week — and
 * nothing re-read them unless someone remembered to.
 *
 * Only importers that can run unattended are here. Prompts, Hidden Tricks and community
 * submissions are filled from reviewed manifests, because each asserts something a
 * fetch cannot establish: that a snippet is quoted verbatim, that a trick is absent from
 * the documentation, that a submission was approved. Those stay manual on purpose, and
 * adding them here would be the one change that breaks what the archive claims.
 *
 * Every importer merges by id and never removes an entry, which is what makes re-running
 * them safe. That is asserted below rather than assumed: if a run ends with fewer entries
 * than it started with, the archive is restored and the run fails.
 */

import { readFile, writeFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

/* Sources that genuinely grow, in the order that costs least if one fails early. */
const IMPORTERS = [
  { script: 'import-hermes-stories.mjs', what: "Nous Research's published community stories" },
  { script: 'import-jev-hermes.mjs',     what: 'Hermes entries in the Jev builder directory' }
];

const run = (script) => new Promise(resolve => {
  const child = spawn(process.execPath, [join(ROOT, 'scripts', script)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  child.on('error', error => resolve({ ok: false, out: error.message }));
  child.on('exit', code => resolve({ ok: code === 0, out }));
});

async function counts() {
  const index = JSON.parse(await readFile(join(DATA, 'index.json'), 'utf8'));
  const out = {};
  for (const section of index.sections) {
    if (!section.file) continue;                       // dashboard and trending are computed
    const raw = JSON.parse(await readFile(join(DATA, section.file), 'utf8'));
    out[section.id] = (Array.isArray(raw) ? raw : raw.items).length;
  }
  return out;
}

const total = c => Object.values(c).reduce((a, b) => a + b, 0);

/**
 * The line worth repeating from a failed importer's output.
 *
 * This took the last line, which on a thrown error is Node's own version banner — the
 * harvest log read `unreachable: import-jev-hermes.mjs — Node.js v20.20.2`, naming the
 * runtime instead of the problem. Prefer the thrown message, then the last line that says
 * anything, so the report names what actually went wrong.
 */
function reason(out) {
  const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
  const thrown = lines.find(l => /^(?:Uncaught\s+)?(?:[A-Z]\w*)?Error: /.test(l));
  if (thrown) return thrown.replace(/^(?:Uncaught\s+)?(?:[A-Z]\w*)?Error: /, '');
  const useful = lines.filter(l => !/^(?:Node\.js v[\d.]+|at\s|\^+$|\s*\}?\s*)$/.test(l));
  return useful.slice(-1)[0] || 'exited non-zero';
}

async function main() {
  if (process.argv.includes('--dry')) {
    console.log('Would run, in order:');
    for (const i of IMPORTERS) console.log(`  ${i.script.padEnd(30)} ${i.what}`);
    console.log('\nNothing written.');
    return;
  }

  const before = await counts();

  /* A failed importer must not be able to leave the archive worse than it found it. */
  const backup = await mkdtemp(join(tmpdir(), 'harvest-'));
  await cp(DATA, join(backup, 'data'), { recursive: true });

  const failed = [];
  for (const { script, what } of IMPORTERS) {
    const result = await run(script);
    if (!result.ok) {
      failed.push([script, reason(result.out)]);
      console.error(`  ${script} failed — ${what}`);
    }
  }

  const after = await counts();

  /* Additive only. Every importer here merges by id; a shelf that shrank means one of
     them stopped doing that, and no amount of new entries makes that acceptable. */
  const shrank = Object.entries(after).filter(([shelf, n]) => n < before[shelf]);
  if (shrank.length) {
    await rm(DATA, { recursive: true, force: true });
    await cp(join(backup, 'data'), DATA, { recursive: true });
    await rm(backup, { recursive: true, force: true });
    console.error('\nA shelf lost entries, which no importer here is allowed to do:');
    for (const [shelf, n] of shrank) console.error(`  ${shelf}: ${before[shelf]} -> ${n}`);
    console.error('The archive has been restored from the pre-run copy.');
    process.exit(1);
  }
  await rm(backup, { recursive: true, force: true });

  const gained = Object.entries(after).filter(([shelf, n]) => n > before[shelf]);
  const added = total(after) - total(before);

  for (const [shelf, n] of gained) console.log(`  ${shelf.padEnd(12)} ${before[shelf]} -> ${n}  (+${n - before[shelf]})`);
  console.log(`\n${added} new ${added === 1 ? 'entry' : 'entries'}; ${total(after)} in the archive.`);
  for (const [script, why] of failed) console.log(`unreachable: ${script} — ${why}`);

  if (added) console.log('\nRun npm run check, then npm run rank so the new entries are classified.');
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
