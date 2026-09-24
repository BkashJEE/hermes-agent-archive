/* Load .env into process.env without a dependency. A value already exported in the
   shell wins, so `TYPESAFE_API_KEY=... npm run route` still overrides the file. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ENV = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');

try {
  for (const line of readFileSync(ENV, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env is fine — every key is optional */ }

/* You are probably already signed in to GitHub with the gh CLI. Borrow that token
   rather than asking for another one — it lifts the API limit from 60/hour to 5000
   and is why seeded repo lookups stop 403ing. Never printed, never written to disk. */
if (!process.env.GITHUB_TOKEN) {
  try {
    const { execFileSync } = await import('node:child_process');
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (/^gh[pousr]_/.test(token)) {
      process.env.GITHUB_TOKEN = token;
      process.env.GITHUB_TOKEN_SOURCE = 'gh cli';
    }
  } catch { /* gh not installed or not signed in — carry on unauthenticated */ }
}
