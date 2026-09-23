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

const mask = v => v.length <= 8 ? '•'.repeat(v.length) : `${v.slice(0, 3)}${'•'.repeat(v.length - 6)}${v.slice(-3)}`;

function parseEnv(text) {
  const out = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out.set(m[1], m[2].replace(/^["']|["']$/g, ''));
  }
  return out;
}

/* Hidden input that still accepts a paste. The prompt is written before the
   interface is muted, so you can see what you're answering but not what you type.
   An EOF (piped or closed stdin) resolves empty instead of hanging forever. */
function askHidden(prompt) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };

    process.stdout.write(prompt);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = true;
    rl._writeToOutput = str => { if (!rl.stdoutMuted) rl.output.write(str); };

    rl.question('', answer => { rl.close(); process.stdout.write('\n'); finish(answer.trim()); });
    rl.on('close', () => finish(''));
  });
}

if (!process.stdin.isTTY) {
  console.error('This needs an interactive terminal — run `npm run key` directly, not through a pipe.');
  process.exit(1);
}

const existing = parseEnv(await readFile(ENV, 'utf8').catch(() => ''));

console.log(`\n  API keys for this repo\n  ──────────────────────`);
console.log(`  Written to .env (gitignored, owner-only). Input is hidden as you paste.`);
console.log(`  Press Enter to skip, or to keep what is already set.\n`);

for (const k of KEYS) {
  const has = existing.get(k.name);
  console.log(`  ${k.label}`);
  console.log(`    ${k.why}`);
  console.log(`    ${has ? `currently ${mask(has)}` : `get one: ${k.get}`}`);
  const value = await askHidden(`    ${k.name}: `);
  if (value) existing.set(k.name, value);
  else if (!has) console.log('    skipped');
  console.log('');
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
