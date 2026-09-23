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
