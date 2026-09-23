#!/usr/bin/env node
/**
 * Paste your API keys once, into a local .env this repo never commits.
 *
 *   npm run key
 *
 * Input is hidden as you paste. The value is written to .env with owner-only
 * permissions and is never printed back, never logged, and never sent anywhere
 * except the API it belongs to. .env is gitignored — check that before you use it.
 *
 * Nothing is required: press Enter to skip a key, or to keep the one already set.
 */

import { readFile, writeFile, chmod, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import readline from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = join(ROOT, '.env');

const KEYS = [
  { name: 'TYPESAFE_API_KEY',     label: 'TypeSafe / Jev',   why: 'routes fetched signals onto the right shelf, and ranks candidate features', get: 'https://typesafe.ai' },
  { name: 'GITHUB_TOKEN',         label: 'GitHub token',     why: 'raises the API limit from 60 to 5000 requests an hour', get: 'https://github.com/settings/tokens — no scopes needed for public data' },
  { name: 'REDDIT_CLIENT_ID',     label: 'Reddit client id', why: 'Reddit refuses anonymous reads, so its section stays empty without this', get: 'https://www.reddit.com/prefs/apps — create a "script" app' },
  { name: 'REDDIT_CLIENT_SECRET', label: 'Reddit secret',    why: 'the other half of the Reddit app credentials', get: 'same app as above' }
];

/* Never render any part of a secret — not the first characters, not the last.
   Length alone is enough to confirm the right thing was pasted. */
const mask = v => `${v.length} chars`;

function parseEnv(text) {
  const out = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out.set(m[1], m[2].replace(/^["']|["']$/g, ''));
  }
  return out;
}

/* A paste area: bordered, masked, and it shows you it is receiving.
   One bullet per character and a live count, so a paste that silently failed
   is obvious. The characters themselves are never rendered or logged. */

const W = 54;                                   // inner width of the box
const ESC = '\x1b';
const up = n => `${ESC}[${n}A`;
const clearLine = `\r${ESC}[2K`;
const dim = t => `${ESC}[2m${t}${ESC}[0m`;
const accent = t => `${ESC}[38;5;154m${t}${ESC}[0m`;

/* Terminals wrap a paste in bracketed-paste markers and may include a trailing
   newline; a key never contains whitespace or control characters. */
function cleanPaste(chunk) {
  return chunk
    .replace(/\x1b\[20[01]~/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();
}

function pasteArea(label) {
  return new Promise(resolve => {
    const stdin = process.stdin;
    const out = process.stdout;
    let buf = '';
    let done = false;

    const bar = '─'.repeat(W);
    let painted = false;

    const draw = () => {
      const shown = Math.min(buf.length, 30);
      const dots = '•'.repeat(shown) + (buf.length > shown ? `+${buf.length - shown}` : '');
      const status = buf.length ? `${buf.length} chars` : 'waiting for paste…';
      const marker = buf.length ? accent('▸') : dim('▸');
      const pad = ' '.repeat(Math.max(1, W - (3 + dots.length + status.length + 1)));

      // Repaint all four lines as one block; no stranded lines, no drift.
      if (painted) out.write(`\r${up(3)}`);
      out.write(`${clearLine}       ┌${bar}┐\n`);
      out.write(`${clearLine}       │ ${marker} ${dots}${pad}${dim(status)} │\n`);
      out.write(`${clearLine}       └${bar}┘\n`);
      out.write(`${clearLine}${dim('         Enter save · Esc skip · Ctrl+U clear · Ctrl+C quit')}`);
      painted = true;
    };

    const finish = value => {
      if (done) return;
      done = true;
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      out.write('\r\n');
      resolve(value);
    };

    const onData = chunk => {
      // A paste arrives as one chunk; a keystroke as one character.
      if (chunk === '\x03') { out.write('\r\n'); process.exit(130); }              // Ctrl+C
      if (chunk === '\x15') { buf = ''; draw(); return; }                          // Ctrl+U
      if (chunk === ESC)     { finish(''); return; }                               // Esc = skip
      if (chunk === '\r' || chunk === '\n') { finish(buf); return; }
      if (chunk === '\x7f' || chunk === '\b') { buf = buf.slice(0, -1); draw(); return; }

      const cleaned = cleanPaste(chunk);
      if (cleaned) { buf += cleaned; draw(); }
      // A chunk ending in a newline is a paste that included one: treat it as Enter.
      if (/[\r\n]$/.test(chunk)) finish(buf);
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    draw();
  });
}

if (!process.stdin.isTTY) {
  console.error('This needs an interactive terminal — run `npm run key` directly, not through a pipe.');
  process.exit(1);
}

const existing = parseEnv(await readFile(ENV, 'utf8').catch(() => ''));

const BOX = 60;
const row = text => {                       // pad by visible width, not by eye
  const plain = text.replace(/\x1b\[[0-9;]*m/g, '');
  return `  │ ${text}${' '.repeat(Math.max(0, BOX - plain.length - 2))} │`;
};

console.log(`\n  ╭${'─'.repeat(BOX)}╮`);
console.log(row(`API KEYS · use-case-archive`));
console.log(row(dim(`Masked input · written to .env (gitignored, chmod 600)`)));
console.log(row(dim(`Nothing here is echoed, logged, or committed.`)));
console.log(`  ╰${'─'.repeat(BOX)}╯\n`);

let i = 0;
for (const k of KEYS) {
  const has = existing.get(k.name);
  i++;
  console.log(`  ${dim(`${i}/${KEYS.length}`)}  ${k.name}   ${dim(k.label)}`);
  console.log(`        ${dim(k.why)}`);
  console.log(`        ${has ? dim(`already set · ${mask(has)} — Enter keeps it`) : dim(`get one → ${k.get}`)}`);
  console.log('');

  const value = await pasteArea(k.name);
  if (value) {
    existing.set(k.name, value);
    console.log(`       ${accent('✓')} stored ${mask(value)}\n`);
  } else {
    console.log(`       ${dim(has ? '· kept the existing key' : '· skipped')}\n`);
  }
}

const body = [
  '# Local secrets for use-case-archive. Gitignored — do not commit this file.',
  `# Written by \`npm run key\` on ${new Date().toISOString().slice(0, 10)}.`,
  ...[...existing].map(([k, v]) => `${k}=${v}`)
].join('\n') + '\n';

await writeFile(ENV, body, { mode: 0o600 });
await chmod(ENV, 0o600);

const mode = (await stat(ENV)).mode & 0o777;
console.log(`  Saved ${existing.size} key(s) to .env (mode ${mode.toString(8)}).`);
console.log(`  Every script loads it automatically now:\n`);
console.log(`    npm run sync    # fetch, then route with Jev`);
console.log(`    npm run rank    # score candidate features\n`);
if (mode !== 0o600) console.warn('  Warning: .env is not owner-only. Run: chmod 600 .env\n');
